# Venkat Reddy’s portfolio

Live site: https://venkat-rj.github.io/

The current site is plain HTML and CSS in `site/`. It presents selected work, professional experience, writing, and a GitHub contribution calendar. Projects and upstream contributions are linked directly from the Work section.

## Preview and deploy

Run `python3 -m http.server 4173 --directory site` from this repository.

Pushes to `main` deploy only `site/` through GitHub Actions. No package installation or build is needed. The previous Astro implementation remains in `src/` and `public/` for reference and is not deployed. Older page URLs redirect to matching sections.

## GitHub contribution calendar

The GitHub Actions workflow runs `node scripts/update-contributions.mjs` using the workflow token to generate `site/assets/github-contributions.svg` from GitHub's official contribution data. The schedule refreshes the image every six hours. Run `node --test tests/contributions.test.mjs` to check the renderer. The token is never included in the published site. The portfolio does not automatically list repositories or pull requests.

## Content

Use grounded descriptions from the owner’s supplied career history. Exploratory research, draft contributions, patent application status, closed products, and prototypes remain explicitly identified. Keep the writing factual and preserve asset attribution in the page.
