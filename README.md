# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A powerful YouTube transcript manager userscript with fuzzy search, AI-powered translation & summarization, and real-time subtitle overlay.

**[Turkce](docs/README.tr.md)** | **[Deutsch](docs/README.de.md)** | **[Espanol](docs/README.es.md)** | **[日本語](docs/README.ja.md)**

## Features

- **One-Click Transcript Extraction** — Grab any YouTube video's transcript with or without timestamps
- **Fuzzy Search** — Powered by [Fuse.js](https://www.fusejs.io/), searches across titles, channels, tags, and transcript content with typo tolerance
- **AI Translation** — Translate into 18 languages via [OpenRouter](https://openrouter.ai/) (any model: Gemini, Claude, GPT, …). Sentences stay whole while subtitles stay in sync: the model groups caption fragments into sentences, and every group's timing comes from the original captions — never from the model
- **Reliable by design** — Structured (JSON) output validated against the source, automatic retries with feedback, rate-limit backoff, cancel at any time, and resume-after-failure without paying twice
- **Consistent terminology** — A first pass builds a short video context and glossary that every chunk follows
- **AI Summarization** — Choose format, tone, length and output language; key moments get clickable timestamps
- **Millisecond timing** — When the video is open, timing comes from the YouTube player's own caption data (millisecond start/end) instead of the transcript panel's whole seconds; falls back to the panel automatically
- **Subtitle Overlay** — Frame-accurate subtitles on the player, optional bilingual mode (translation + original), adjustable size/colour/background, moves out of the way of player controls. Over-long subtitles are sent back to the model to be split
- **Timing adjustment** — Shift subtitles earlier/later from settings or while watching with `[` / `]` (0.1 s, Shift = 0.5 s) and `\` to reset
- **Subtitle Export** — Download translations as `.srt` or `.vtt`
- **Transcript Library** — Everything is stored locally in IndexedDB with favorites, tags, fuzzy search and stats
- **Viewer** — Original / Translation / Summary tabs, click a timestamp to jump there, current line follows playback
- **Cost Tracking** — Exact cost per translation reported inline by OpenRouter
- **Private** — Your API key lives in userscript storage (not readable by youtube.com); requests go straight to OpenRouter
- **Light & dark theme**, keyboard accessible dialogs and menus

## Installation

### From Release (Recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
2. Download `subscribe.user.js` from the [latest release](https://github.com/umitaltintas/subscribe/releases/latest)
3. Open Tampermonkey dashboard and drag the file into it — or create a new script and paste the contents

### From Source

```bash
bun install
bun run build
```

The built userscript will be at `dist/userscript.js`.

### Development

```bash
bun run watch      # Rebuild on file changes
bun run typecheck  # Run TypeScript type checking
bun test           # Unit tests (parsing, chunking, validation, translation flow)
```

## Usage

Once installed, you'll see new buttons on YouTube:

### Navbar
- **Library** (SubScribe logo) — Opens the dashboard with your transcript library
- **Settings** (gear icon) — API key (with a "Test" button), model (with live price info), languages, subtitle appearance

### Video Page
- **Transcript** — Extract, tag and save the current video's transcript
- **Translate** — Translates and turns on subtitles; shows progress (click to cancel). Once saved, the same button toggles subtitles
- **Language menu (▾)** — Switch target language, view the translation as text, re-translate, subtitle settings
- **Summarize** — Generate a summary; once saved, opens it

### Dashboard Tabs

| Tab | Description |
|-----|-------------|
| History | All saved transcripts with fuzzy search and filters |
| Favorites | Bookmarked transcripts |
| Translations | View and manage translated transcripts |
| Stats | Total videos, tokens, words, channels, and more |
| Data | Settings shortcut, export/import (includes translations & summaries), rebuild search index |

### AI Translation Setup

1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Click the settings (gear) button on YouTube's navbar
3. Enter your API key and press **Test**, pick a model and target language
4. Click **Translate** on any video — subtitles appear on the player as soon as it finishes

## Tech Stack

- **TypeScript** — Fully typed codebase
- **esbuild** — Fast bundling into a single IIFE userscript
- **Fuse.js** — Client-side fuzzy search engine
- **IndexedDB** — Local storage for transcripts (no server, no accounts)
- **OpenRouter API** — Multi-model AI with structured outputs and cost tracking
- **Trusted Types** — CSP-compatible DOM manipulation

## Project Structure

```
src/
├── index.ts              # Entry point, initialization
├── config.ts             # Constants and configuration
├── types.ts              # TypeScript type definitions
├── db.ts                 # IndexedDB wrapper (TranscriptDB)
├── transcript.ts         # YouTube DOM transcript extraction
├── search.ts             # Fuse.js search manager
├── ai.ts                 # Translation & summarization prompts and pipeline
├── openrouter.ts         # OpenRouter client (retries, structured output, cost)
├── http.ts               # GM_xmlhttpRequest wrapper with cancellation
├── segments.ts           # Pure caption parsing, chunking, validation, SRT/VTT
├── timedtext.ts          # Millisecond caption data from the YouTube player
├── translation-service.ts # Jobs, persistence and subtitles shared by all UI
├── settings-store.ts     # Settings in userscript storage
├── subtitle-overlay.ts   # Real-time subtitle display on video
├── router.ts             # YouTube SPA navigation handler
├── dom.ts                # DOM utilities and CSS injection
├── icons.ts              # SVG icon library
├── utils.ts              # Helper functions
├── trusted-types.ts      # Trusted Types policy
├── global.d.ts           # Tampermonkey API type declarations
└── ui/
    ├── navbar.ts          # Masthead buttons and video page actions
    ├── dashboard.ts       # Library modal
    ├── viewer.ts          # Original / translation / summary viewer
    ├── copy-modal.ts      # Copy & tag modal
    ├── settings.ts        # Settings modal
    ├── summary-options.ts # Summary options dialog
    ├── modal.ts           # Accessible modal + confirm dialog
    ├── menu.ts            # Dropdown menu
    └── require-key.ts     # API key guard
tests/                     # bun test suites
```

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

[MIT](LICENSE)
