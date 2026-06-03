# Briefcast — Project Context

## What This Is
A locally-run Electron desktop app that records meetings, transcribes them, summarizes them with AI, and manages action items in a Kanban-style task board. Everything runs on your machine — no cloud sync, no subscriptions.

---

## Architecture

### Tech Stack
- **Electron** — desktop app shell (cross-platform, Windows-first)
- **OpenAI Whisper API** — audio transcription
- **Anthropic Claude API** — meeting summarization and action item extraction
- **VB-Cable** — virtual audio driver for capturing system audio (Zoom, Teams, Meet, etc.)
- **SoX** — command-line audio recorder, reads from VB-Cable output device
- **Vanilla JS + CSS** — no frontend framework, keeps it lightweight
- **Local JSON files** — all persistence, no database

### File Structure
```
briefcast/
├── src/
│   ├── main.js        # Electron main process — recording, IPC handlers, file I/O, API calls
│   ├── preload.js     # Context bridge — safely exposes main process to renderer
│   ├── index.html     # App shell and layout
│   ├── renderer.js    # All UI logic, state, Kanban board, tab navigation
│   └── styles.css     # Full dark theme using CSS variables
├── package.json
├── README.md
└── CONTEXT.md
```

### Data Storage
All data lives in `%APPDATA%/briefcast/` on Windows:
- `tasks.json` — task board state
- `meetings.json` — meeting history and summaries
- `settings.json` — API keys and audio device name
- `recordings/` — raw `.wav` files

---

## How It Works

### Recording Flow
1. User clicks **Start Recording**
2. Main process spawns a SoX child process recording from `CABLE Output (VB-Audio Virtual Cable)`
3. Audio saved as 16kHz mono `.wav` to the recordings directory
4. User clicks **Stop & Process**
5. SoX process is killed and given 800ms to flush the file

### Processing Flow
1. `.wav` file sent to **OpenAI Whisper API** → returns timestamped transcript
2. Transcript sent to **Claude API** → returns JSON with `summary` and `tasks[]`
3. Tasks rendered in an editable list for review before saving
4. User hits **Save All Tasks** → tasks written to `tasks.json`, meeting written to `meetings.json`

### Task Board
- Three columns: **To Do / In Progress / Done**
- Each task has: title, priority (Low/Medium/High/Critical), category, customer, creation date, status
- Filter by category and priority
- Move tasks between columns via card buttons
- All changes auto-saved to disk

---

## Key Design Decisions

- **Electron over a local web server** — feels like a real shipped product, better for portfolio and demos
- **Windows-first** — built for Windows with VB-Cable; Mac port requires swapping VB-Cable for BlackHole and updating the SoX device name in `main.js`
- **No framework** — vanilla JS keeps the app fast and easy to read
- **JSON over a database** — simple, portable, human-readable, no setup required
- **Demo mode fallback** — if no OpenAI key or audio capture fails, Claude still generates realistic tasks from a placeholder transcript so the app is always usable

---

## Mac Port (When Ready)
Only two things need to change:
1. Install **BlackHole** instead of VB-Cable (https://existential.audio/blackhole/)
2. In `src/main.js`, update the SoX device name:
```js
// Windows
"CABLE Output (VB-Audio Virtual Cable)"

// Mac
"BlackHole 2ch"
```
SoX on Mac: `brew install sox`

---

## Known Limitations / Next Steps
- [ ] Real-time waveform visualization during recording (currently simulated)
- [ ] Speaker diarization (identify who said what — requires Whisper large model or Pyannote)
- [ ] Export tasks to CSV
- [ ] Edit task titles inline on the Kanban board
- [ ] Electron auto-updater
- [ ] App icon and proper packaging (`electron-builder`)
- [ ] "Listen while recording" audio passthrough setup guide
