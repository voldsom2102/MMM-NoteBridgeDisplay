"use strict";

const js = require("@eslint/js");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
	js.configs.recommended,
	{
		files: ["**/*.js"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "commonjs",
			globals: {
				Buffer: "readonly",
				CSS: "readonly",
				clearInterval: "readonly",
				console: "readonly",
				document: "readonly",
				NodeHelper: "readonly",
				module: "readonly",
				process: "readonly",
				require: "readonly",
				setInterval: "readonly"
			}
		}
	}
]);
