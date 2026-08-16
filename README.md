# NOTFLICKS

A production-friendly mock streaming interface for choosing a film on camera.

## What it does

- Separate production setup screen and clean on-camera screen.
- Paste film titles and resolve posters/backdrops with TMDB.
- Optional year matching, e.g. `Alien (1979)`.
- Manual film entry and custom artwork URLs.
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

For automatic movie matching, add a TMDB **API Read Access Token** in the setup screen. The token is stored only in that browser's local storage; it is not included in this repository.

Press **Find artwork**, check the resulting library, then press **Launch screen**.

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

TMDB's API currently supports movie title search at `/3/search/movie`, and its image service can build image URLs from returned poster/backdrop paths. Review TMDB's current API terms and the rights required for artwork shown in your production before broadcast/commercial use.

This product uses the TMDB API but is not endorsed or certified by TMDB.
