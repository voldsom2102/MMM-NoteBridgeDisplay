"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getSupabaseCredentials } = require("../lib/supabase-config");

test("reads Supabase credentials from the server environment", () => {
	const credentials = getSupabaseCredentials({
		NOTEBRIDGE_SUPABASE_URL: "https://example.supabase.co",
		NOTEBRIDGE_SUPABASE_ANON_KEY: "public-key"
	});

	assert.deepEqual(credentials, {
		supabaseUrl: "https://example.supabase.co",
		supabaseAnonKey: "public-key"
	});
});

test("requires both Supabase server environment variables", () => {
	assert.throws(
		() => getSupabaseCredentials({ NOTEBRIDGE_SUPABASE_URL: "https://example.supabase.co" }),
		/NOTEBRIDGE_SUPABASE_URL and NOTEBRIDGE_SUPABASE_ANON_KEY/
	);
});
