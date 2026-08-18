# NOTFLICKS

A production-friendly mock streaming interface for choosing a film on camera.

## What it does

- Separate production setup screen and clean on-camera screen.
- Paste film titles and automatically look up poster/lead artwork from Wikipedia/Wikimedia with no API key or account.
- Optional year matching, e.g. `Alien (1979)`.
- Google Images fallback button for films that need different artwork.
- Manual film editing and custom poster/backdrop URLs.
- Horizontal poster carousel with centre focus.
- Slow scroll/arrow-key movement selects one film at a time.
- Fast wheel, trackpad swipe or pointer swipe triggers a genuine random spin.
- Random spin decelerates with a tick on every film change.
- Keyboard lock, fullscreen and random controls.
- Optional hidden production buttons.
- Film list/settings persist in the browser with `localStorage`.
- App shell and previously loaded artwork are cached by a service worker for production resilience.

## Use

Open `setup.html` and paste one film title per line.

Press **Find artwork**. NOTFLICKS searches Wikipedia for each film and uses its associated poster/lead image where available. No account, token or payment setup is required.

If a film has no suitable automatic artwork, press **GOOGLE** beside it to open a Google Images search, then press **EDIT** and paste the poster or backdrop image URL you want to use.

Check the resulting library, then press **Launch screen**.

### On-screen keyboard controls

- `←` previous film
- `→` next film
- `Space` random spin
- `L` lock/unlock selection
- `F` fullscreen
- `Shift` + `A` return to production setup

A sufficiently fast wheel/trackpad gesture or horizontal swipe also starts the random selector.

## Hosting

The project is intentionally static and needs no build step or backend. It can be hosted directly with GitHub Pages or any ordinary static web host.

For GitHub Pages: repository **Settings → Pages → Deploy from a branch → main / root**.

## Production notes

The app is branded **NOTFLICKS** and is intended to evoke a generic premium streaming UI rather than copy Netflix branding or assets.

Artwork availability varies by title and source. Review the rights required for any poster or image you intend to show in a broadcast or commercial production.
