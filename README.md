# Planuf Apps

This repository is the shared home for Planuf production tools hosted with GitHub Pages.

## Structure

- `/` — Planuf Apps landing page.
- `/notflicks/` — NOTFLICKS app and its Cloudflare Worker.
- `/checklist/` — Show Production Checklist and its Cloudflare Worker.
- `/apps.json` — landing-page app registry.

## Rule for future apps

Every new app gets its own top-level folder and keeps its frontend, configuration, documentation and Worker code inside that folder. Adding a new app should not modify the internals of an existing app; add the new folder and register it in `/apps.json`.

## Shared writes

Both current apps use Cloudflare Workers to write shared data back to this repository without exposing GitHub write credentials in browser code.
