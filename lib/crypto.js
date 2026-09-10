"use strict";

/**
 * Shared AES-256-GCM helpers used to encrypt/decrypt the note-bridge
 * credentials stored in config.js. The passphrase used to derive the key is
 * never stored on disk; it must be supplied at runtime via the
 * NOTEBRIDGE_PASSPHRASE environment variable (or a custom variable named by
 * the user's `passphraseEnv` config option).
 */

const crypto = require("crypto");

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // recommended GCM nonce size
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_DIGEST = "sha256";

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

module.exports = { encrypt, decrypt };
