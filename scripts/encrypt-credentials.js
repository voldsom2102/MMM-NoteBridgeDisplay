#!/usr/bin/env node
"use strict";

/**
 * Interactive CLI to encrypt note-bridge credentials for use in config.js.
 *
 * Usage:
 *   NOTEBRIDGE_PASSPHRASE="a strong secret" node scripts/encrypt-credentials.js
 *
 * You will be prompted for the note-bridge account email, password and (optionally) note encryption secret. The
 * script prints config entries you paste into this module's config block.
 * The passphrase itself is never printed or stored; you must export the same
 * NOTEBRIDGE_PASSPHRASE value in the environment that runs MagicMirror so the
 * module can decrypt the credentials at startup.
 */

const readline = require("readline");
const { encrypt } = require("../lib/crypto");

function prompt(question, { hidden = false } = {}) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		if (!hidden) {
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer.trim());
			});
			return;
		}

		// Mask input for sensitive values (password, passphrase).
		const stdin = process.stdin;
		process.stdout.write(question);
		let value = "";
		const onData = (char) => {
			char = char.toString("utf8");
			if (char === "\n" || char === "\r" || char === "\u0004") {
				stdin.removeListener("data", onData);
				stdin.setRawMode && stdin.setRawMode(false);
				stdin.pause();
				process.stdout.write("\n");
				rl.close();
				resolve(value.trim());
				return;
			}
			if (char === "\u0003") {
				process.exit(1);
			}
			if (char === "\u007f" || char === "\b") {
				value = value.slice(0, -1);
				return;
			}
			value += char;
		};
		stdin.setRawMode && stdin.setRawMode(true);
		stdin.resume();
		stdin.on("data", onData);
	});
}

async function main() {
	const passphrase = process.env.NOTEBRIDGE_PASSPHRASE;
	if (!passphrase) {
		console.error(
			"ERROR: NOTEBRIDGE_PASSPHRASE environment variable is not set.\n" +
				"Set it to a strong secret before running this script, e.g.:\n" +
				'  NOTEBRIDGE_PASSPHRASE="correct-horse-battery-staple" node scripts/encrypt-credentials.js'
		);
		process.exit(1);
	}

	console.log("MMM-NoteBridgeDisplay credential encryption\n");
	const email = await prompt("Note-bridge account email: ");
	const password = await prompt("Note-bridge account password: ", { hidden: true });

	const noteSecret = await prompt(
		"Note-bridge encryption secret (leave blank if notes are not encrypted): ",
		{ hidden: true }
	);

	if (!email || !password) {
		console.error("Email and password are both required.");
		process.exit(1);
	}

	const encryptedEmail = encrypt(email, passphrase);
	const encryptedPassword = encrypt(password, passphrase);

	console.log("\nAdd these entries to your MagicMirror config.js module config:\n");
	const output = { auth: { email: encryptedEmail, password: encryptedPassword } };
	if (noteSecret) {
		output.noteEncryptionSecret = encrypt(noteSecret, passphrase);
	}
	const configEntries = Object.entries(output)
		.map(([key, value]) => {
			const serializedValue = JSON.stringify(value, null, "\t").replace(/\n/g, "\n\t");
			return `\t${key}: ${serializedValue},`;
		})
		.join("\n");
	console.log(configEntries);
	console.log(
		"\nRemember: export NOTEBRIDGE_PASSPHRASE with the same passphrase in the " +
			"environment that runs MagicMirror (e.g. in your systemd unit, pm2 " +
			"ecosystem file, or shell profile). Never commit the passphrase itself."
	);
}

main().catch((err) => {
	console.error("Failed to encrypt credentials:", err.message);
	process.exit(1);
});
