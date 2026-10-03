"use strict";

const js = require("@eslint/js");

module.exports = [
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
];
