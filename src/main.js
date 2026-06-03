const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");

// ─── Paths ───────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath("userData"), "briefcast");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");
const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");

function ensureDirs() {
  [DATA_DIR, RECORDINGS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── Recording ───────────────────────────────────────────────────────────────
let recordingProcess = null;
let currentRecordingPath = null;

ipcMain.handle("start-recording", async () => {
  const filename = `recording-${Date.now()}.wav`;
  currentRecordingPath = path.join(RECORDINGS_DIR, filename);

  // Uses SoX (sox) to record from CABLE Output (VB-Cable virtual device)
  // Install SoX: https://sourceforge.net/projects/sox/
  // VB-Cable sets up "CABLE Output" as a recording device
  recordingProcess = spawn("sox", [
    "-t", "waveaudio",
    "CABLE Output (VB-Audio Virtual Cable)", // Windows VB-Cable device name
    currentRecordingPath,
    "rate", "16000",   // Whisper prefers 16kHz
    "channels", "1",   // Mono
  ]);

  recordingProcess.stderr.on("data", (d) => {
    console.log("SOX:", d.toString());
  });

  return { success: true, path: currentRecordingPath };
});

ipcMain.handle("stop-recording", async () => {
  if (recordingProcess) {
    recordingProcess.kill("SIGTERM");
    recordingProcess = null;
  }
  // Give SoX a moment to flush and close the file
  await new Promise((r) => setTimeout(r, 800));
  return { success: true, path: currentRecordingPath };
});

// ─── Transcription (Whisper via OpenAI API) ──────────────────────────────────
ipcMain.handle("transcribe", async (_, { audioPath, apiKey }) => {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(audioPath), {
      filename: "audio.wav",
      contentType: "audio/wav",
    });
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json"); // gives us timestamps too

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );

    return { success: true, transcript: response.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Summarize + Extract Tasks (Claude) ──────────────────────────────────────
ipcMain.handle("summarize", async (_, { transcript, apiKey }) => {
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `You are a meeting assistant. Given a meeting transcript, extract:
1. A 2-3 sentence summary
2. Action items as structured tasks

Respond ONLY with valid JSON, no markdown fences:
{
  "summary": "string",
  "tasks": [
    {
      "title": "string — clear, actionable task",
      "priority": "Low | Medium | High | Critical",
      "category": "Engineering | Design | Sales | Customer Success | Internal | Product",
      "customer": "string or null — infer customer name from context if mentioned",
      "notes": "string or null — any extra context"
    }
  ]
}`,
        messages: [{ role: "user", content: `Meeting transcript:\n\n${transcript}` }],
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    const text = response.data.content.map((b) => b.text || "").join("");
    const parsed = JSON.parse(text);
    return { success: true, ...parsed };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Task CRUD ────────────────────────────────────────────────────────────────
ipcMain.handle("load-tasks", () => loadJSON(TASKS_FILE, []));
ipcMain.handle("save-tasks", (_, tasks) => {
  saveJSON(TASKS_FILE, tasks);
  return { success: true };
});

// ─── Meeting History ──────────────────────────────────────────────────────────
ipcMain.handle("load-meetings", () => loadJSON(MEETINGS_FILE, []));
ipcMain.handle("save-meeting", (_, meeting) => {
  const meetings = loadJSON(MEETINGS_FILE, []);
  meetings.unshift(meeting); // newest first
  saveJSON(MEETINGS_FILE, meetings);
  return { success: true };
});

// ─── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
ipcMain.handle("load-settings", () => loadJSON(SETTINGS_FILE, {}));
ipcMain.handle("save-settings", (_, settings) => {
  saveJSON(SETTINGS_FILE, settings);
  return { success: true };
});
