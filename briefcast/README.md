# ⬡ Briefcast

AI-powered meeting recorder, transcriber, and task manager. Records your meetings (including Zoom, Teams, Google Meet via VB-Cable), transcribes with Whisper, summarizes with Claude, and drops action items into a local Kanban board — no subscriptions, no cloud sync, everything lives on your machine.

---

## Features

- 🎙️ **One-click recording** — captures system audio via VB-Cable (Zoom, Meet, Teams, anything)
- 📝 **AI transcription** — OpenAI Whisper converts audio to timestamped transcript
- 🤖 **Smart summarization** — Claude extracts a summary + structured action items
- 📋 **Local Kanban board** — To Do / In Progress / Done columns, filter by priority and category
- 💾 **Fully local** — all tasks and meeting history saved to your machine as JSON, no database needed
- 🔒 **Private** — your API keys and data never leave your computer (other than API calls)

---

## Prerequisites

### 1. Node.js
Make sure Node.js is installed. Check with:
```bash
node -v
```
Download from https://nodejs.org if needed.

### 2. VB-Cable (virtual audio device)
VB-Cable lets Briefcast capture audio from Zoom, Teams, Meet, etc.

1. Download from https://vb-audio.com/Cable/
2. Install and restart your computer
3. In **Windows Sound Settings → Playback**, right-click **CABLE Input** → Set as Default Device
   - This routes all your computer audio through VB-Cable
4. In your meeting app (Zoom, etc.), set the speaker output to **CABLE Input**
5. Briefcast records from **CABLE Output** — it captures everything your meeting plays

> **Tip:** You can still hear the meeting yourself by enabling "Listen to this device" on CABLE Output in Windows Sound settings, or by using a separate speaker device in Zoom alongside CABLE Input.

### 3. SoX (audio recording utility)
SoX is used to capture audio from VB-Cable.

1. Download from https://sourceforge.net/projects/sox/
2. During install, check **"Add to PATH"**
3. Verify: open a terminal and run `sox --version`

### 4. API Keys
You'll need:
- **OpenAI API key** — for Whisper transcription (https://platform.openai.com)
- **Anthropic API key** — for Claude summarization (https://console.anthropic.com)

---

## Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/briefcast.git
cd briefcast

# Install dependencies
npm install

# Start the app
npm start
```

---

## First-Time Setup

1. Launch the app with `npm start`
2. Click **Settings** in the sidebar
3. Enter your OpenAI and Anthropic API keys
4. Confirm the audio device name (default: `CABLE Output (VB-Audio Virtual Cable)`)
5. Click **Save Settings**

---

## How to Use

1. Start a Zoom/Meet/Teams call as normal
2. Open Briefcast and click **● START RECORDING**
3. When your meeting ends, click **■ STOP & PROCESS**
4. Briefcast transcribes the audio and generates:
   - A meeting summary
   - Action items with priority, category, and customer tags
5. Review and edit the tasks, then click **SAVE ALL TASKS →**
6. Tasks appear in the **Task Board** — move them between columns as you work through them

---

## Tech Stack

- **Electron** — desktop app shell
- **OpenAI Whisper API** — speech-to-text transcription
- **Anthropic Claude API** — meeting summarization and task extraction
- **VB-Cable + SoX** — system audio capture on Windows
- **Vanilla JS + CSS** — no frontend framework, fast and lightweight
- **Local JSON files** — all data stored in `%APPDATA%/briefcast/` on Windows

---

## Porting to Mac

When you're ready to run this on macOS:

1. Replace VB-Cable with **BlackHole** (https://existential.audio/blackhole/)
2. In `src/main.js`, update the SoX device name:
   ```js
   // Windows
   "CABLE Output (VB-Audio Virtual Cable)"

   // Mac (BlackHole 2ch)
   "BlackHole 2ch"
   ```
3. SoX on Mac: `brew install sox`
4. Everything else stays the same

---

## Data Location

All data is stored locally at:
- **Windows:** `C:\Users\YOU\AppData\Roaming\briefcast\`
- **Mac:** `~/Library/Application Support/briefcast/`

Files:
- `tasks.json` — your task board
- `meetings.json` — meeting history and summaries
- `settings.json` — API keys and preferences
- `recordings/` — raw `.wav` files from each session

---

## License

MIT
