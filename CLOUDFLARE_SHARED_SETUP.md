# NOTFLICKS shared saving — Cloudflare setup

NOTFLICKS now uses a Cloudflare Worker as the only component allowed to write to GitHub.

The browser never receives the GitHub write token. App users only need the shared edit PIN.

## 1. Create a fine-grained GitHub token

Create a fine-grained personal access token restricted to **ChipButt/NOTFLICKS**.

Repository permission required:

- **Contents: Read and write**

Nothing else is required.

## 2. Create the Worker

Deploy the files in `worker/` as a Cloudflare Worker named `notflicks-shared-api`.

You can use Wrangler:

```bash
cd worker
npx wrangler@latest login
npx wrangler@latest secret put GITHUB_TOKEN
npx wrangler@latest secret put EDIT_PIN
npx wrangler@latest deploy
```

Enter the GitHub token for `GITHUB_TOKEN` and choose a strong shared production PIN/passphrase for `EDIT_PIN`.

Cloudflare stores both as encrypted Worker secrets. Do not add either value to source code or `wrangler.jsonc`.

## 3. Add the Worker URL to NOTFLICKS

After deployment Cloudflare gives you a URL similar to:

`https://notflicks-shared-api.<account-subdomain>.workers.dev`

Open `app-v13-shared.js` and replace:

`PASTE_YOUR_NOTFLICKS_WORKER_URL_HERE`

with that Worker URL, then commit the change.

## 4. How it works

- Anyone opening NOTFLICKS can load the shared `films.json` library.
- Local edits are marked as unsaved.
- **Save shared library** asks for the edit PIN if this browser tab does not already have it.
- The PIN is held only in `sessionStorage`, so closing the tab/browser clears it.
- The Worker verifies the PIN and writes the new `films.json` to GitHub using its private GitHub token.
- Other devices load the updated library next time they open/reload NOTFLICKS.
- If another device saved a newer version first, NOTFLICKS refuses to overwrite it and asks you to reload the latest shared version.

## Security

Keep `ALLOWED_ORIGINS` set to the actual GitHub Pages origin. For the normal `ChipButt` GitHub Pages account that is:

`https://chipbutt.github.io`

CORS is an extra browser restriction; the edit PIN is the actual write-authorisation gate. Use a strong PIN/passphrase rather than a four-digit number.
