"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encrypt, decrypt } = require("../lib/crypto");

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
