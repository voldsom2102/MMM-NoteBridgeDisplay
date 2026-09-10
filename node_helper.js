"use strict";

/**
 * node_helper for MMM-NoteBridgeDisplay.
 *
 * Runs on the MagicMirror server side (Node.js), where it is safe to hold
 * decrypted credentials in memory. It signs in to Supabase as the
 * note-bridge user and polls for the configured note, forwarding the result
 * to the front-end module via socket notifications.
 */

const NodeHelper = require("node_helper");
const { createClient } = require("@supabase/supabase-js");
const { decrypt } = require("./lib/crypto");

module.exports = NodeHelper.create({
	start() {
		this.config = null;
		this.supabase = null;
		this.pollTimer = null;
		this.session = null;
	},

	stop() {
		this.clearPoll();
	},

	clearPoll() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	},

	socketNotificationReceived(notification, payload) {
		if (notification === "NOTEBRIDGE_INIT") {
			this.config = payload;
			this.initialize().catch((err) => this.sendError(err));
		}
	},

	sendError(err) {
		const message = err && err.message ? err.message : String(err);
		console.error("[MMM-NoteBridgeDisplay] " + message);
		this.sendSocketNotification("NOTEBRIDGE_ERROR", { message });
	},

	getPassphrase() {
		const envVar = this.config.passphraseEnv || "NOTEBRIDGE_PASSPHRASE";
		const passphrase = process.env[envVar];
		if (!passphrase) {
			throw new Error(
				"Environment variable " + envVar + " is not set. It must contain the " +
					"passphrase used to encrypt your note-bridge credentials."
			);
		}
		return passphrase;
	},

	async initialize() {
		const { supabaseUrl, supabaseAnonKey, auth } = this.config;

		if (!supabaseUrl || !supabaseAnonKey) {
			throw new Error("supabaseUrl and supabaseAnonKey must be set in the module config.");
		}
		if (!auth || !auth.email || !auth.password) {
			throw new Error(
				"auth.email and auth.password (encrypted credential objects) must be " +
					"set in the module config. Generate them with scripts/encrypt-credentials.js."
			);
		}

		const passphrase = this.getPassphrase();
		const email = decrypt(auth.email, passphrase);
		const password = decrypt(auth.password, passphrase);

		this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
			auth: { persistSession: false, autoRefreshToken: true }
		});

		const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			throw new Error("Supabase sign-in failed: " + error.message);
		}
		this.session = data.session;

		await this.fetchNote();
		this.clearPoll();
		const updateInterval = Math.max(this.config.updateInterval || 60000, 15000);
		this.pollTimer = setInterval(() => {
			this.fetchNote().catch((err) => this.sendError(err));
		}, updateInterval);
	},

	async fetchNote() {
		const { noteId, noteTitle } = this.config;
		if (!noteId && !noteTitle) {
			throw new Error("Either noteId or noteTitle must be set in the module config.");
		}

		let query = this.supabase
			.from("notes")
			.select("id, title, content, updated_at")
			.is("deleted_at", null)
			.limit(1);

		query = noteId ? query.eq("id", noteId) : query.eq("title", noteTitle);

		const { data, error } = await query.maybeSingle();
		if (error) {
			throw new Error("Failed to fetch note: " + error.message);
		}
		if (!data) {
			this.sendSocketNotification("NOTEBRIDGE_NOTE_NOT_FOUND", {});
			return;
		}

		this.sendSocketNotification("NOTEBRIDGE_NOTE", {
			id: data.id,
			title: data.title,
			content: data.content,
			updatedAt: data.updated_at
		});
	}
});
