/* global Module Log moment */

/**
 * MMM-NoteBridgeDisplay
 * Displays a single note pulled from a note-bridge (Supabase) account.
 */
Module.register("MMM-NoteBridgeDisplay", {
	defaults: {
		auth: null, // { email: {encrypted}, password: {encrypted} }
		passphraseEnv: "NOTEBRIDGE_PASSPHRASE",
		noteId: "",
		noteTitle: "",
		updateInterval: 5 * 60 * 1000,
		showTitle: true,
		showLastUpdated: true,
		maxWidth: "400px",
		titleColor: "",
		listColor: "",
		backgroundColor: "",
		animationSpeed: 750
	},

	requiresVersion: "2.2.0",

	getStyles() {
		return ["MMM-NoteBridgeDisplay.css"];
	},

	start() {
		this.note = null;
		this.errorMessage = null;
		this.loaded = false;
		this.sendSocketNotification("NOTEBRIDGE_INIT", this.config);
	},

	getDom() {
		const wrapper = document.createElement("div");
		wrapper.className = "notebridge-wrapper";
		wrapper.style.maxWidth = this.config.maxWidth;
		this.setColor(wrapper, "backgroundColor", this.config.backgroundColor);

		if (this.errorMessage) {
			wrapper.classList.add("notebridge-error");
			wrapper.innerHTML = this.errorMessage;
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.classList.add("dimmed", "light", "small");
			wrapper.innerHTML = this.translate("LOADING");
			return wrapper;
		}

		if (!this.note) {
			wrapper.classList.add("dimmed", "light", "small");
			wrapper.innerHTML = this.translate("NOT_FOUND");
			return wrapper;
		}

		if (this.config.showTitle && this.note.title) {
			const title = document.createElement("div");
			title.className = "notebridge-title";
			this.setColor(title, "color", this.config.titleColor);
			title.textContent = this.note.title;
			wrapper.appendChild(title);
		}

		const content = document.createElement("div");
		content.className = "notebridge-content";
		this.setColor(content, "color", this.config.listColor);
		content.textContent = this.note.content;
		wrapper.appendChild(content);

		if (this.config.showLastUpdated && this.note.updatedAt) {
			const updated = document.createElement("div");
			updated.className = "notebridge-updated small dimmed";
			const date = new Date(Number(this.note.updatedAt));
			updated.textContent = this.translate("LAST_UPDATED") + ": " + date.toLocaleString();
			wrapper.appendChild(updated);
		}

		return wrapper;
	},

	setColor(element, property, value) {
		if (!value || !this.isColor(value)) {
			return;
		}
		element.style[property] = value;
	},

	isColor(value) {
		if (typeof value !== "string") {
			return false;
		}

		const hexColor = /^#[\da-f]{3,4}$|^#[\da-f]{6}$|^#[\da-f]{8}$/i;
		return hexColor.test(value) || (/^[a-z]+$/i.test(value) && CSS.supports("color", value));
	},

	getTranslations() {
		return {
			en: "translations/en.json",
			es: "translations/es.json"
		};
	},

	socketNotificationReceived(notification, payload) {
		if (notification === "NOTEBRIDGE_NOTE") {
			this.note = payload;
			this.errorMessage = null;
			this.loaded = true;
			this.updateDom(this.config.animationSpeed);
		} else if (notification === "NOTEBRIDGE_NOTE_NOT_FOUND") {
			this.note = null;
			this.errorMessage = null;
			this.loaded = true;
			this.updateDom(this.config.animationSpeed);
		} else if (notification === "NOTEBRIDGE_ERROR") {
			Log.error("[MMM-NoteBridgeDisplay] " + payload.message);
			this.errorMessage = this.translate("ERROR") + ": " + payload.message;
			this.loaded = true;
			this.updateDom(this.config.animationSpeed);
		}
	}
});
