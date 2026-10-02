"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encrypt, decrypt, decryptNote } = require("../lib/crypto");

test("encrypt/decrypt round-trips plaintext", () => {
	const passphrase = "correct horse battery staple";
	const plaintext = "user@example.com";

	const payload = encrypt(plaintext, passphrase);
	assert.equal(decrypt(payload, passphrase), plaintext);
});

test("decrypt fails with wrong passphrase", () => {
	const payload = encrypt("secret-value", "right-passphrase");
	assert.throws(() => decrypt(payload, "wrong-passphrase"));
});

test("encrypt produces different ciphertext each time (random salt/iv)", () => {
	const a = encrypt("same-value", "pass");
	const b = encrypt("same-value", "pass");
	assert.notEqual(a.ciphertext, b.ciphertext);
	assert.notEqual(a.salt, b.salt);
	assert.notEqual(a.iv, b.iv);
});

test("decrypt throws on malformed payload", () => {
	assert.throws(() => decrypt({}, "pass"));
});

test("decrypt throws when passphrase is missing", () => {
	const payload = encrypt("value", "pass");
	assert.throws(() => decrypt(payload, undefined));
});

test("decryptNote reads the Android note encryption format", () => {
	const note = {
		id: "note-1",
		title:
			"notebridge-encrypted-v1:000102030405060708090a0b0c0d0e0f:" +
			"101112131415161718191a1b:e5b1485c8bf81635de012773ef96f6252642c0f6e96aa6b5a637225186ba2f",
		content:
			"notebridge-encrypted-v1:000102030405060708090a0b0c0d0e0f:" +
			"202122232425262728292a2b:f6b4b98b45eefdcb62551216e39ef988312a8fece85d95df44a4cd74f531"
	};

	assert.deepEqual(
		decryptNote(note, "Note@Example.com", "some-encryption-secret"),
		{ ...note, title: "A private title", content: "A private body" }
	);
});

test("decryptNote leaves legacy plaintext notes unchanged", () => {
	const note = { id: "note-1", title: "Title", content: "Body" };
	assert.equal(decryptNote(note, "note@example.com", undefined), note);
});

test("decryptNote rejects partially encrypted notes", () => {
	const note = {
		id: "note-1",
		title: "notebridge-encrypted-v1:...",
		content: "Body"
	};
	assert.throws(() => decryptNote(note, "note@example.com", "secret"), /only one encrypted field/);
});

test("decryptNote reports a missing note encryption secret", () => {
	const note = {
		id: "note-1",
		title: "notebridge-encrypted-v1:...",
		content: "notebridge-encrypted-v1:..."
	};
	assert.throws(
		() => decryptNote(note, "note@example.com", ""),
		/noteEncryptionSecret.*module config/
	);
});

test("decryptNote fails authentication when the note encryption secret is wrong", () => {
	const note = {
		id: "note-1",
		title:
			"notebridge-encrypted-v1:000102030405060708090a0b0c0d0e0f:" +
			"101112131415161718191a1b:e5b1485c8bf81635de012773ef96f6252642c0f6e96aa6b5a637225186ba2f",
		content:
			"notebridge-encrypted-v1:000102030405060708090a0b0c0d0e0f:" +
			"202122232425262728292a2b:f6b4b98b45eefdcb62551216e39ef988312a8fece85d95df44a4cd74f531"
	};
	assert.throws(
		() => decryptNote(note, "note@example.com", "wrong-secret"),
		/Unable to decrypt note/
	);
});
