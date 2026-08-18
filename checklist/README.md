# Show Production Checklist

This app is isolated inside `/checklist/` in the Planuf Apps repository.

Shared state is stored at `checklist/data/checklist.json`; uploaded assets are stored under `checklist/assets/`.

Deploy the Worker from `checklist/worker/`, set Cloudflare secrets `GITHUB_TOKEN` and `EDIT_PIN`, then paste the Worker URL into `checklist/config.js`.

The GitHub token should be fine-grained, restricted to `ChipButt/NOTFLICKS`, with Contents read/write permission only.
