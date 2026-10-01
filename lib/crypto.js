"use strict";

/**
 * AES-256-GCM helpers for encrypted credentials and note-bridge note fields.
 * Credential encryption uses a separate passphrase from note-field
 * encryption, which follows the Android app's key derivation and payload format.
 */

const crypto = require("crypto");

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // recommended GCM nonce size
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_DIGEST = "sha256";
const NOTE_ENCRYPTION_PREFIX = "notebridge-encrypted-v1";
const NOTE_KEY_LENGTH = 32;
const NOTE_PBKDF2_ITERATIONS = 310000;
const NOTE_PBKDF2_DIGEST = "sha1";
const NOTE_SALT_LENGTH = 16;
const NOTE_NONCE_LENGTH = 12;
const NOTE_TAG_LENGTH = 16;

function deriveKey(passphrase, salt) {
	if (!passphrase) {
		throw new Error(
			"No passphrase supplied. Set the NOTEBRIDGE_PASSPHRASE environment " +
				"variable before starting MagicMirror."
		);
	}
	return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypts plaintext with a passphrase-derived key.
 * Returns a compact object safe to store in config.js.
 */
function encrypt(plaintext, passphrase) {
	const salt = crypto.randomBytes(SALT_LENGTH);
	const iv = crypto.randomBytes(IV_LENGTH);
	const key = deriveKey(passphrase, salt);

	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
	const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return {
		salt: salt.toString("base64"),
		iv: iv.toString("base64"),
		authTag: authTag.toString("base64"),
		ciphertext: ciphertext.toString("base64")
	};
}

/**
 * Decrypts a payload produced by encrypt() using the given passphrase.
 * Throws if the passphrase is wrong or the payload has been tampered with.
 */
function decrypt(payload, passphrase) {
	if (!payload || !payload.salt || !payload.iv || !payload.authTag || !payload.ciphertext) {
		throw new Error("Malformed encrypted credential payload.");
	}

	const salt = Buffer.from(payload.salt, "base64");
	const iv = Buffer.from(payload.iv, "base64");
	const authTag = Buffer.from(payload.authTag, "base64");
	const ciphertext = Buffer.from(payload.ciphertext, "base64");
	const key = deriveKey(passphrase, salt);

	const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(authTag);

	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return plaintext.toString("utf8");
}

function parseNoteField(value) {
	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== NOTE_ENCRYPTION_PREFIX) {
		throw new Error("Encrypted note data has an unsupported format.");
	}

	const [, saltHex, nonceHex, ciphertextHex] = parts;
	if (
		![saltHex, nonceHex, ciphertextHex].every((part) => /^(?:[\da-f]{2})+$/i.test(part))
	) {
		throw new Error("Encrypted note data has an invalid encoding.");
	}

	const salt = Buffer.from(saltHex, "hex");
	const nonce = Buffer.from(nonceHex, "hex");
	const ciphertext = Buffer.from(ciphertextHex, "hex");
	if (
		salt.length !== NOTE_SALT_LENGTH ||
		nonce.length !== NOTE_NONCE_LENGTH ||
		ciphertext.length < NOTE_TAG_LENGTH
	) {
		throw new Error("Encrypted note data is invalid.");
	}

	return { salt, nonce, ciphertext };
}

function decryptNote(note, email, secret) {
	if (!note || typeof note.title !== "string" || typeof note.content !== "string") {
		throw new Error("Malformed note data.");
	}

	const titleEncrypted = note.title.startsWith(NOTE_ENCRYPTION_PREFIX);
	const contentEncrypted = note.content.startsWith(NOTE_ENCRYPTION_PREFIX);
	if (!titleEncrypted && !contentEncrypted) {
		return note;
	}
	if (titleEncrypted !== contentEncrypted) {
		throw new Error("A note has only one encrypted field; refusing to display partial data.");
	}
	if (typeof note.id !== "string" || !note.id) {
		throw new Error("Encrypted note data is missing its note ID.");
	}
	if (typeof email !== "string" || !email.trim()) {
		throw new Error("A note-bridge account email is required to decrypt encrypted notes.");
	}
	if (typeof secret !== "string" || !secret) {
		throw new Error(
			"Encrypted notes require noteEncryptionSecret to be set in config.local.js."
		);
	}

	const title = parseNoteField(note.title);
	const content = parseNoteField(note.content);
	if (!title.salt.equals(content.salt)) {
		throw new Error("Encrypted note fields have mismatched salts.");
	}

	const password = Buffer.from(
		email.trim().toLowerCase() + "\u0000" + secret,
		"utf8"
	);
	const key = crypto.pbkdf2Sync(
		password,
		title.salt,
		NOTE_PBKDF2_ITERATIONS,
		NOTE_KEY_LENGTH,
		NOTE_PBKDF2_DIGEST
	);

	function decryptField(field, name) {
		const decipher = crypto.createDecipheriv("aes-256-gcm", key, field.nonce);
		decipher.setAAD(Buffer.from(note.id + "\u0000" + name, "utf8"));
		decipher.setAuthTag(field.ciphertext.subarray(-NOTE_TAG_LENGTH));
		const ciphertext = field.ciphertext.subarray(0, -NOTE_TAG_LENGTH);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
	}

	try {
		return {
			...note,
			title: decryptField(title, "title"),
			content: decryptField(content, "content")
		};
	} catch (err) {
		throw new Error(
			"Unable to decrypt note. Check noteEncryptionSecret and verify the synced note data."
		);
	} finally {
		key.fill(0);
		password.fill(0);
	}
}

module.exports = { encrypt, decrypt, decryptNote };
