# Venkat Reddy’s portfolio

Live site: https://venkat-rj.github.io/

The current site is plain HTML, CSS, and a small GitHub activity module in `site/`. It presents research leadership, experience, current work, writing, and public contributions across four GitHub accounts.

## Preview and deploy

Run `python3 -m http.server 4173 --directory site` from this repository.

Pushes to `main` deploy only `site/` through GitHub Actions. No package installation or build is needed. The previous Astro implementation remains in `src/` and `public/` for reference and is not deployed. Older page URLs redirect to matching sections.

## GitHub activity

Run `node scripts/update-github.mjs` to refresh the bundled public snapshot. Run `node --test tests/github.test.mjs` to check the activity module. The browser also refreshes public data with a 15-minute cache and retains saved content if GitHub is unavailable. No tokens or private repository data are included.

## Content

Use grounded descriptions from the owner’s supplied career history. Exploratory research, draft contributions, patent application status, closed products, and prototypes remain explicitly identified. Keep the writing factual and preserve asset attribution in the page.
