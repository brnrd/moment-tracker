# Moment Tracker

A small, minimalist **moment tracker** built with [Svelte](https://svelte.dev) and [Astro](https://astro.build), just for fun.

It lets you mark meaningful life events — like quitting a habit, starting a relationship, or any personal milestone — and shows you how much time has passed since.

**Use it here:** [https://moments.vegetalope.com/](https://moments.vegetalope.com/)

## Features

- Add multiple moments with a label, date, and optional time
- Shows elapsed time in years, months, and days
- Tap elapsed time to toggle days/hours for spans under a year, or years/months/days and total days for longer spans; the next view is labeled
- Gentle hints for anniversaries and round-number day milestones
- Optional personal memories, collapsed beneath each moment
- Archive and restore moments
- Share one moment from its visible Share action: preview and copy a message, or use the device share menu where available
- Share or import (replace or merge) your data via one shared field and a Unicode-safe encoded string
- Download and restore JSON backups, with an import preview
- Undo deletion or the most recent import
- Reorder moments by dragging or with touch- and keyboard-friendly buttons
- Light/dark theme (system or user preference)
- Logical/EU/US date format toggle

No backend, no tracking, no bloat. Just local storage and a shareable string.

## Tech

- [Svelte](https://svelte.dev)
- [Astro](https://astro.build)
- No UI framework or CSS libraries

## Running locally

```bash
npm install
npm run dev
```

## License

Unlicensed. Use it however you want.

## Data and dates

Moments stay in this browser’s local storage. Backups and share codes include notes and archived moments; a code is encoded, not encrypted. Older moment codes remain supported.

Dates and optional times use the device’s local time zone. Date-only moments count calendar days. Anniversaries appear up to 30 days ahead; February 29 anniversaries fall on February 28 in non-leap years. Day milestones appear at 100, 500, 1,000, 5,000, and 10,000 days.

Total hours use the optional time, or local midnight when no time is set. Each moment remembers its own display preference. Backup and import feedback stays inside Settings.
