"use strict";

const SUPABASE_URL_ENV = "NOTEBRIDGE_SUPABASE_URL";
const SUPABASE_ANON_KEY_ENV = "NOTEBRIDGE_SUPABASE_ANON_KEY";

function getSupabaseCredentials(environment) {
	const supabaseUrl = environment[SUPABASE_URL_ENV];
	const supabaseAnonKey = environment[SUPABASE_ANON_KEY_ENV];

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			"Environment variables " + SUPABASE_URL_ENV + " and " + SUPABASE_ANON_KEY_ENV +
				" must be set on the MagicMirror server."
		);
	}

	return { supabaseUrl, supabaseAnonKey };
}

module.exports = { getSupabaseCredentials };
