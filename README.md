# MMM-NoteBridgeDisplay

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that
connects to a [note-bridge](https://github.com/voldsom2102/simpleNotes)
(Supabase-backed) account and displays one specific note on your mirror.

Note-bridge account credentials are stored **encrypted** in `config.js`
(AES-256-GCM, key derived via PBKDF2 from a passphrase you keep out of the
repo, e.g. in an environment variable). Decryption only ever happens in the
Node.js `node_helper` process on the server side — plaintext credentials are
never sent to the browser/front-end.

The Supabase project URL and publishable key are server environment variables,
not MagicMirror configuration options. This prevents them from being included
in the module configuration that MagicMirror sends to the browser.

## Screenshot

_(add a screenshot here once you have the module running)_

## Installation

```sh
cd ~/MagicMirror/modules
git clone https://github.com/<your-username>/MMM-NoteBridgeDisplay.git
cd MMM-NoteBridgeDisplay
npm install
```

## Encrypting your credentials

1. Choose a strong passphrase. This passphrase is **not** stored anywhere in
   this module — you must supply it at runtime via an environment variable
   (default name: `NOTEBRIDGE_PASSPHRASE`).
2. Run the encryption helper and follow the prompts:

   ```sh
   NOTEBRIDGE_PASSPHRASE="a strong secret passphrase" node scripts/encrypt-credentials.js
   ```

3. The script prints an `auth` object. Copy it into the module's config block
   in `config.js` (see below).
4. Make sure the following values are available in the environment that
   actually runs MagicMirror (shell profile, systemd unit `Environment=` line,
   pm2 ecosystem file, `.env` loaded before start, etc):

   ```sh
   NOTEBRIDGE_PASSPHRASE="a strong secret passphrase"
   NOTEBRIDGE_SUPABASE_URL="https://your-project.supabase.co"
   NOTEBRIDGE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```

   Never commit the passphrase or Supabase credentials to git.

## Configuration

Add the module to the `modules` array in your `config.js`:

```js
{
	module: "MMM-NoteBridgeDisplay",
	position: "top_right",
	config: {
		// Paste the object printed by scripts/encrypt-credentials.js:
		auth: {
			email: { salt: "...", iv: "...", authTag: "...", ciphertext: "..." },
			password: { salt: "...", iv: "...", authTag: "...", ciphertext: "..." }
		},
		passphraseEnv: "NOTEBRIDGE_PASSPHRASE", // env var holding the decryption passphrase
		noteId: "", // UUID of the note to display, OR
		noteTitle: "Grocery List", // match by exact title if noteId is not set
		updateInterval: 5 * 60 * 1000, // how often to re-fetch the note, ms
		showTitle: true,
		showLastUpdated: true,
		maxWidth: "400px"
	}
}
```

### Config options

| Option            | Type    | Default                   | Description                                                                 |
| ----------------- | ------- | ------------------------- | --------------------------------------------------------------------------- |
| `auth`            | object  | `null`                    | Encrypted `{ email, password }` credential payloads (see above).            |
| `passphraseEnv`   | string  | `"NOTEBRIDGE_PASSPHRASE"` | Name of the environment variable holding the decryption passphrase.         |
| `noteId`          | string  | `""`                      | UUID of the note to display. Takes priority over `noteTitle` if both are set. |
| `noteTitle`       | string  | `""`                      | Exact title of the note to display, used if `noteId` is not set.             |
| `updateInterval`  | number  | `300000`                  | Milliseconds between note refreshes (minimum enforced: 15000).               |
| `showTitle`       | boolean | `true`                    | Show the note title above its content.                                       |
| `showLastUpdated` | boolean | `true`                    | Show the note's last-updated timestamp.                                      |
| `maxWidth`        | string  | `"400px"`                 | CSS max-width applied to the module wrapper.                                 |

### Server environment variables

| Variable | Description |
| --- | --- |
| `NOTEBRIDGE_SUPABASE_URL` | The note-bridge Supabase project URL. |
| `NOTEBRIDGE_SUPABASE_ANON_KEY` | The project publishable/anon API key. This must not be a service-role key. |

## How it works

- The front-end module (`MMM-NoteBridgeDisplay.js`) only ever handles
  already-decrypted note text; it never touches Supabase or account credentials.
- `node_helper.js` runs server-side, decrypts the configured credentials with
  the passphrase from the environment, signs in to Supabase as the
  note-bridge user (`auth.signInWithPassword`), and queries the `notes` table
  for the configured note. This means access is governed by the same
  row-level-security policies as the mobile/web app — the module can only
  ever read notes belonging to that account.
- The note is re-fetched on `updateInterval` so edits made elsewhere show up
  on the mirror.

## Security notes

- Credentials are encrypted with AES-256-GCM; the key is derived from your
  passphrase using PBKDF2 (210,000 iterations, SHA-256) with a random salt
  per secret.
- The passphrase is never written to disk by this module and must be
  supplied via environment variable at runtime.
- The Supabase project URL and anon key are read only by the server-side
  helper from `NOTEBRIDGE_SUPABASE_URL` and `NOTEBRIDGE_SUPABASE_ANON_KEY`;
  they cannot be supplied in MagicMirror's module config.
- Rotate credentials by re-running `scripts/encrypt-credentials.js` and
  updating `config.js`.
- This module intentionally does not support the Supabase service-role key,
  to avoid bypassing row-level security.

## Development

```sh
npm test
```

Runs unit tests for the encryption/decryption helpers in `lib/crypto.js`.

## License

MIT
