# SubScribe

A powerful YouTube transcript manager userscript with fuzzy search, AI-powered translation, and real-time subtitle overlay.

## Features

- **One-Click Transcript Extraction** — Grab any YouTube video's transcript with or without timestamps
- **Fuzzy Search** — Powered by [Fuse.js](https://www.fusejs.io/), searches across titles, channels, tags, and transcript content with typo tolerance
- **AI Translation** — Translate transcripts into 10+ languages via [OpenRouter](https://openrouter.ai/) (supports any model: Gemini, Claude, GPT, etc.)
- **Subtitle Overlay** — Display translated subtitles directly on the YouTube video player in real-time
- **Transcript Library** — All transcripts are stored locally in IndexedDB with favorites, tags, and stats
- **Dashboard** — Full management UI with history, favorites, translations tab, stats, and data export/import
- **Cost Tracking** — See token usage and cost per translation via OpenRouter's generation API

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
2. Build the userscript:
   ```bash
   npm install
   npm run build
   ```
3. Copy the contents of `dist/userscript.js` into a new Tampermonkey script — or set up Tampermonkey to load from a local file

### Development

```bash
npm run watch    # Rebuild on file changes
npm run typecheck # Run TypeScript type checking
```

## Usage

Once installed, you'll see two new buttons on YouTube:

### Navbar
- **Transcript Manager** button (document icon) — Opens the dashboard with your transcript library
- **Settings** button (gear icon) — Configure AI translation settings

### Video Page
- **Transkript** button — Extract and save the current video's transcript
- **Translate** button — Translate the transcript and show subtitles on the video

### Dashboard Tabs
| Tab | Description |
|-----|-------------|
| History | All saved transcripts with fuzzy search and filters |
| Favorites | Bookmarked transcripts |
| Translations | View and manage translated transcripts |
| Stats | Total videos, tokens, words, channels, and more |
| Settings | Export/import data, rebuild search index |

### AI Translation Setup

1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Click the settings (gear) button on YouTube's navbar
3. Enter your API key, select a model and target language
4. Click "Translate" on any video — subtitles will appear on the player

## Tech Stack

- **TypeScript** — Fully typed codebase
- **esbuild** — Fast bundling into a single IIFE userscript
- **Fuse.js** — Client-side fuzzy search engine
- **IndexedDB** — Local storage for transcripts (no server, no accounts)
- **OpenRouter API** — Multi-model AI translation with cost tracking
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
├── ai.ts                 # OpenRouter translation logic
├── subtitle-overlay.ts   # Real-time subtitle display on video
├── router.ts             # YouTube SPA navigation handler
├── dom.ts                # DOM utilities and CSS injection
├── icons.ts              # SVG icon library
├── utils.ts              # Helper functions
├── trusted-types.ts      # Trusted Types policy
├── global.d.ts           # Tampermonkey API type declarations
└── ui/
    ├── navbar.ts          # YouTube navbar button injection
    ├── dashboard.ts       # Main dashboard modal
    ├── viewer.ts          # Transcript viewer modal
    ├── copy-modal.ts      # Copy & tag modal
    └── settings.ts        # AI settings modal
```

## License

[MIT](LICENSE)
