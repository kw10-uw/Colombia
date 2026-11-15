# TurboColombia · El Parche

A mobile-first, offline-capable Colombia trip planner for Gaba, Janek, Konrad, and Julia. Built with React, TypeScript, Vite, IndexedDB, and an optional Supabase backend. Designed for GitHub Pages at `https://kw10-uw.github.io/Colombia/`.

## Run locally

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Source avatar PNGs and optimized WebP thumbnails are included. To regenerate the thumbnails and install icons: `node scripts/prepare-assets.mjs`.

## What works

- Pick an avatar once; the browser remembers it. Switch travelers from the top-right avatar. This is contextual attribution, not a verified identity or fingerprinting.
- Add, edit, remove, reorder, and date destinations. Add activities with dates, times, booking links, notes, and Planned / Booked / Done status. Change an activity’s date to move it to another day.
- Shortlist stays from any booking site; compare total prices, collect each traveler’s vote, and mark favorites or bookings.
- A curated starter collection of regional foods linked to Reddit discussions, and sights linked to official visitor guides. Search/filter ideas, save new links and notes, and turn discoveries into plans. The app links out to Reddit searches; it does not automatically scrape Reddit or claim a live recommendation feed.
- Attach PDFs, photos, HEIC files, or text documents (15 MB max) to activities, stays, or expenses. Download files to the device before traveling offline. Downloads retain the original format; HEIC display depends on device support.
- Equal or custom expense shares, payer attribution, categories, four currencies, historical per-expense exchange rates, trip totals, budget tracking, exact-cent balances, suggested repayments, and payment recording. Payments are records only; the app does not move money.
- Currency calculator with editable rates and optional refresh from ExchangeRate-API. Initial rates are explicitly illustrative. Existing expenses do not change when rates refresh.
- Installable PWA with locally bundled avatars and offline app shell. Trip records/files use IndexedDB; clearing site data removes the local copy. Browser storage persistence is best effort.
- ZIP backups with local document files; imports add new copies instead of overwriting the trip. Download all shared files before exporting a complete backup.

## Connect all four phones

See [Supabase setup](docs/SETUP.md). The app works locally without this. **Shared edits and shared documents require a configured backend; GitHub Pages alone cannot store them.**

One phone creates a shared trip using the Supabase project URL and public publishable/anon key, then privately shares an invite link. Other phones open the invite, pick their traveler, back up any existing local trip, and join. Joining intentionally replaces that phone’s current trip; the UI requires acknowledgment. Trip records sync on changes, reconnection, app focus, and every 20 seconds while the app is visible. Offline edits queue on the device.

The backend checks membership and a record’s revision before accepting edits. Concurrent edits to the same record are shown in Settings for explicit resolution. This is record-level conflict handling, not collaborative character-by-character editing. Destination order changes are separate records; simultaneous route reorder actions may require manually adjusting the final order.

Trip name, broad trip dates, budget, current traveler, and calculator rates are device preferences. Itinerary, destinations, ideas, stays/votes, documents, expenses, and settlements are shared records. Do not open a second independent trip on the same origin without first backing up; this version stores one trip per browser profile.

## Deploy to your GitHub repository

The included `.github/workflows/deploy.yml` installs dependencies, runs the expense tests, builds, and deploys to GitHub Pages when `main` changes.

If Pages is not enabled or the repository’s plan does not support it, the build still runs and produces an artifact; deployment is skipped with a notice. Once hosting is enabled, rerun the workflow. `node scripts/enable-pages.mjs` can enable workflow-based Pages using an existing Git Credential Manager session; it never changes repository visibility.

1. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
2. Push this project to `main` in `kw10-uw/Colombia`.
3. Check the Actions deployment and the actual Pages URL it returns.

GitHub Pages requires a supported paid plan for a private repository. Keep the repository private unless you intentionally choose to change it. The public app shell includes the four illustrated avatars; no trip details or original group photograph are embedded in source. Connected trip data and documents stay behind membership rules in Supabase.

The build uses relative paths and works at the `/Colombia/` project path. No frontend secrets, environment variables, or server are required. A public Supabase key is entered on each device or supplied through the private invite fragment. **Never use a service-role or secret key in the browser.**

## Validation

`npm test` verifies exact-cent allocation, unequal shares, currency conversion snapshots, deletion handling, settlement conservation, and safe external URLs. `npm run build` checks TypeScript and generates the service worker.

Browser tests: `npx playwright test` (uses installed Edge on Windows; install Playwright Chromium on other systems). They exercise local flows, mobile layouts, backup/restore, and offline behavior against a production build. Supabase integration requires your own configured project and a separate multi-device acceptance pass; it cannot be verified without one.

## Recommendation sources

Food summaries were researched on 15 November 2026. They are paraphrased community suggestions, not endorsements of a particular restaurant or guarantees of current hours, prices, availability, or accessibility.

- [Cartagena regional dishes](https://www.reddit.com/r/cartagena/comments/1s3hdhq/)
- [Bogotá food discussion](https://www.reddit.com/r/Bogota/comments/1or549y/)
- [Medellín traditional food discussion](https://www.reddit.com/r/medellin/comments/sfdhzc/)
- Official destination guides: [Bogotá](https://colombia.travel/en/bogota), [Cartagena](https://colombia.travel/en/cartagena-de-indias), [Medellín](https://colombia.travel/en/medellin), [Salento](https://colombia.travel/en/salento)

Fonts: DM Sans and Outfit, loaded from Google Fonts when online; system sans-serif fallbacks work offline. Avatars were generated from the user-provided reference with the built-in image generator; source prompt notes are in `public/avatars/`.
