// ─── State ────────────────────────────────────────────────────────────────────
let tasks = [];
let meetings = [];
let settings = {};
let recording = false;
let elapsed = 0;
let timerInterval = null;
let lastAudioPath = null;
let lastDuration = 0;
let newTasksFromMeeting = [];
let filterCategory = "All";
let filterPriority = "All";

const PRIORITY_COLORS = {
  Low: "#4ade80",
  Medium: "#facc15",
  High: "#f97316",
  Critical: "#ef4444",
};

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  tasks = await window.api.loadTasks();
  meetings = await window.api.loadMeetings();
  settings = await window.api.loadSettings();

  buildWaveBars();
  renderTaskBoard();
  renderHistory();
  loadSettingsUI();
  updateTaskCountBadge();
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
  });
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const panel = tab.closest("section");
    panel.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    panel.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    panel.querySelector(`#tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ─── Waveform ─────────────────────────────────────────────────────────────────
function buildWaveBars() {
  const container = document.getElementById("wave-bars");
  container.innerHTML = "";
  for (let i = 0; i < 36; i++) {
    const bar = document.createElement("div");
    bar.className = "wave-bar";
    bar.style.height = "4px";
    container.appendChild(bar);
  }
}

let waveInterval = null;
function startWaveAnimation() {
  const bars = document.querySelectorAll(".wave-bar");
  waveInterval = setInterval(() => {
    bars.forEach((bar) => {
      bar.style.height = `${Math.floor(Math.random() * 32 + 4)}px`;
      bar.style.background = "#f59e0b";
    });
  }, 120);
}

function stopWaveAnimation() {
  clearInterval(waveInterval);
  document.querySelectorAll(".wave-bar").forEach((bar) => {
    bar.style.height = "4px";
    bar.style.background = "var(--border2)";
  });
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Record Button ────────────────────────────────────────────────────────────
const recordBtn = document.getElementById("record-btn");
recordBtn.addEventListener("click", async () => {
  if (!recording) {
    // Check for API keys first
    if (!settings.anthropicKey) {
      alert("Please add your API keys in Settings first.");
      return;
    }

    recording = true;
    elapsed = 0;

    recordBtn.textContent = "■ STOP & PROCESS";
    recordBtn.classList.add("danger");
    document.getElementById("rec-dot").style.display = "inline";
    document.getElementById("rec-status").textContent = "RECORDING";

    startWaveAnimation();
    timerInterval = setInterval(() => {
      elapsed++;
      document.getElementById("timer").textContent = formatTime(elapsed);
    }, 1000);

    const result = await window.api.startRecording();
    lastAudioPath = result.path;
  } else {
    recording = false;
    lastDuration = elapsed;
    clearInterval(timerInterval);
    stopWaveAnimation();

    recordBtn.style.display = "none";
    document.getElementById("rec-dot").style.display = "none";
    document.getElementById("rec-status").textContent = "";
    document.getElementById("processing-panel").style.display = "flex";

    await window.api.stopRecording();
    await processRecording();
  }
});

// ─── Processing ───────────────────────────────────────────────────────────────
async function processRecording() {
  const steps = [
    "Transcribing audio...",
    "Analyzing conversation...",
    "Extracting action items...",
    "Generating summary...",
  ];

  for (const step of steps) {
    document.getElementById("processing-step").textContent = step;
    await delay(800);
  }

  // Transcribe
  let transcriptText = "";
  let transcriptSegments = [];

  if (settings.openaiKey && lastAudioPath) {
    const tResult = await window.api.transcribe({
      audioPath: lastAudioPath,
      apiKey: settings.openaiKey,
    });

    if (tResult.success) {
      transcriptText = tResult.transcript.text;
      transcriptSegments = tResult.transcript.segments || [];
    }
  }

  // If no real transcript, use a demo placeholder so Claude still generates tasks
  if (!transcriptText) {
    transcriptText = `[Demo mode — no audio captured or OpenAI key missing. Duration: ${formatTime(lastDuration)}]
PM: Let's go over the action items from last week.
Customer: We still need the API integration finished.
PM: Understood. I'll have engineering prioritize that this sprint.
Customer: Also the mobile onboarding flow needs work — users are dropping off at step 3.
PM: Can you send over the analytics data?
Customer: Sure, I'll send it today.
PM: Great. I'll confirm the timeline for SSO by end of week.`;
  }

  // Summarize with Claude
  const sResult = await window.api.summarize({
    transcript: transcriptText,
    apiKey: settings.anthropicKey,
  });

  document.getElementById("processing-panel").style.display = "none";
  document.getElementById("result-panel").style.display = "block";

  // Summary
  const summary = sResult.success ? sResult.summary : "Meeting processed. See action items below.";
  document.getElementById("summary-text").textContent = summary;
  document.getElementById("meta-duration").textContent = `Duration: ${formatTime(lastDuration)}`;
  document.getElementById("meta-date").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  // Tasks
  newTasksFromMeeting = (sResult.success ? sResult.tasks : []).map((t) => ({
    ...t,
    id: uid(),
    status: "To Do",
    createdAt: new Date().toISOString(),
    customer: t.customer || null,
    notes: t.notes || null,
  }));

  document.getElementById("meta-tasks").textContent = `${newTasksFromMeeting.length} action items`;
  renderNewTasks(newTasksFromMeeting);

  // Transcript
  renderTranscript(transcriptText, transcriptSegments);
}

// ─── Render New Tasks (post-recording) ───────────────────────────────────────
function renderNewTasks(taskList) {
  const container = document.getElementById("new-tasks-list");
  container.innerHTML = "";

  taskList.forEach((task, i) => {
    const row = document.createElement("div");
    row.className = "new-task-row";
    row.style.animationDelay = `${i * 0.05}s`;
    row.innerHTML = `
      <div class="priority-dot" style="background:${PRIORITY_COLORS[task.priority]}"></div>
      <div class="task-title-text" contenteditable="true" data-id="${task.id}">${task.title}</div>
      <select class="inline-select" data-id="${task.id}" data-field="priority">
        ${["Low","Medium","High","Critical"].map(p => `<option ${p===task.priority?"selected":""}>${p}</option>`).join("")}
      </select>
      <select class="inline-select" data-id="${task.id}" data-field="category">
        ${["Engineering","Design","Sales","Customer Success","Internal","Product"].map(c => `<option ${c===task.category?"selected":""}>${c}</option>`).join("")}
      </select>
    `;
    container.appendChild(row);
  });

  // Bind inline edits
  container.querySelectorAll(".inline-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const t = newTasksFromMeeting.find((t) => t.id === e.target.dataset.id);
      if (t) t[e.target.dataset.field] = e.target.value;
      if (e.target.dataset.field === "priority") {
        const dot = e.target.closest(".new-task-row").querySelector(".priority-dot");
        dot.style.background = PRIORITY_COLORS[e.target.value];
      }
    });
  });

  container.querySelectorAll("[contenteditable]").forEach((el) => {
    el.addEventListener("blur", (e) => {
      const t = newTasksFromMeeting.find((t) => t.id === e.target.dataset.id);
      if (t) t.title = e.target.textContent.trim();
    });
  });
}

// ─── Save Tasks from Meeting ──────────────────────────────────────────────────
document.getElementById("save-tasks-btn").addEventListener("click", async () => {
  tasks = [...tasks, ...newTasksFromMeeting];
  await window.api.saveTasks(tasks);

  // Save meeting to history
  const meeting = {
    id: uid(),
    date: new Date().toISOString(),
    duration: lastDuration,
    summary: document.getElementById("summary-text").textContent,
    taskCount: newTasksFromMeeting.length,
  };
  meetings.unshift(meeting);
  await window.api.saveMeeting(meeting);

  updateTaskCountBadge();
  renderTaskBoard();
  renderHistory();

  // Switch to task board
  document.querySelector('[data-view="tasks"]').click();
});

// ─── Transcript Render ────────────────────────────────────────────────────────
function renderTranscript(text, segments) {
  const panel = document.getElementById("transcript-panel");
  panel.innerHTML = "";

  const lines = text.split("\n").filter(Boolean);
  lines.forEach((line) => {
    const match = line.match(/^\[?(\d+:\d+)\]?\s+(.+?):\s+(.+)$/);
    const row = document.createElement("div");
    if (match) {
      const [, time, speaker, content] = match;
      const isPM = speaker.toLowerCase().includes("pm") || speaker.toLowerCase().includes("host");
      row.className = `bubble-row ${isPM ? "pm" : "other"}`;
      row.innerHTML = `
        <div class="bubble">
          <div class="bubble-meta">
            <span class="speaker">${speaker}</span>
            <span class="bubble-time">${time}</span>
          </div>
          <div class="bubble-text">${content}</div>
        </div>`;
    } else {
      row.style.cssText = "color:#444;font-size:12px;font-family:var(--mono);padding:4px 0;";
      row.textContent = line;
    }
    panel.appendChild(row);
  });
}

// ─── Task Board (Kanban) ──────────────────────────────────────────────────────
function renderTaskBoard() {
  const cols = { "To Do": "col-todo", "In Progress": "col-inprogress", "Done": "col-done" };
  const counts = { "To Do": 0, "In Progress": 0, "Done": 0 };

  Object.values(cols).forEach((id) => (document.getElementById(id).innerHTML = ""));

  const filtered = tasks.filter((t) => {
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    return true;
  });

  filtered.forEach((task) => {
    const status = task.status || "To Do";
    const colId = cols[status] || "col-todo";
    counts[status] = (counts[status] || 0) + 1;
    document.getElementById(colId).appendChild(makeCard(task));
  });

  // Update counts
  document.querySelectorAll(".col-count").forEach((el, i) => {
    const statuses = ["To Do", "In Progress", "Done"];
    el.textContent = counts[statuses[i]] || 0;
  });

  updateTaskCountBadge();
}

function makeCard(task) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.dataset.id = task.id;

  const date = new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  card.innerHTML = `
    <div class="card-title">${task.title}</div>
    <div class="card-meta">
      <span class="tag tag-priority-${task.priority}">${task.priority}</span>
      <span class="tag tag-category">${task.category}</span>
      ${task.customer ? `<span class="tag tag-customer">${task.customer}</span>` : ""}
      <span class="card-date">${date}</span>
    </div>
    <div class="card-actions">
      ${task.status !== "In Progress" ? `<button class="card-btn" data-id="${task.id}" data-action="inprogress">→ In Progress</button>` : ""}
      ${task.status !== "Done" ? `<button class="card-btn" data-id="${task.id}" data-action="done">✓ Done</button>` : ""}
      ${task.status !== "To Do" ? `<button class="card-btn" data-id="${task.id}" data-action="todo">↺ To Do</button>` : ""}
      <button class="card-btn delete" data-id="${task.id}" data-action="delete">✕</button>
    </div>
  `;

  card.querySelectorAll(".card-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { id, action } = btn.dataset;
      if (action === "delete") {
        tasks = tasks.filter((t) => t.id !== id);
      } else {
        const statusMap = { inprogress: "In Progress", done: "Done", todo: "To Do" };
        const task = tasks.find((t) => t.id === id);
        if (task) task.status = statusMap[action];
      }
      await window.api.saveTasks(tasks);
      renderTaskBoard();
    });
  });

  return card;
}

// ─── Filters ──────────────────────────────────────────────────────────────────
document.getElementById("filter-category").addEventListener("change", (e) => {
  filterCategory = e.target.value;
  renderTaskBoard();
});
document.getElementById("filter-priority").addEventListener("change", (e) => {
  filterPriority = e.target.value;
  renderTaskBoard();
});

// ─── History ─────────────────────────────────────────────────────────────────
function renderHistory() {
  const container = document.getElementById("history-list");
  container.innerHTML = "";

  if (!meetings.length) {
    container.innerHTML = `<div class="empty-state">◷ No meetings recorded yet</div>`;
    return;
  }

  meetings.forEach((m) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-date">${new Date(m.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
      <div class="history-summary">${m.summary}</div>
      <div class="history-meta">
        <span>Duration: ${formatTime(m.duration)}</span>
        <span>${m.taskCount} tasks generated</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadSettingsUI() {
  if (settings.openaiKey) document.getElementById("openai-key").value = settings.openaiKey;
  if (settings.anthropicKey) document.getElementById("anthropic-key").value = settings.anthropicKey;
  if (settings.audioDevice) document.getElementById("audio-device").value = settings.audioDevice;
}

document.getElementById("save-settings-btn").addEventListener("click", async () => {
  settings.openaiKey = document.getElementById("openai-key").value.trim();
  settings.anthropicKey = document.getElementById("anthropic-key").value.trim();
  settings.audioDevice = document.getElementById("audio-device").value.trim() || "CABLE Output (VB-Audio Virtual Cable)";

  await window.api.saveSettings(settings);
  document.getElementById("settings-status").textContent = "✓ Saved";
  setTimeout(() => (document.getElementById("settings-status").textContent = ""), 2000);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substr(2, 9); }
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function updateTaskCountBadge() {
  const open = tasks.filter((t) => t.status !== "Done").length;
  document.getElementById("task-count-badge").textContent = `${open} open task${open !== 1 ? "s" : ""}`;
}

// ─── Start ───────────────────────────────────────────────────────────────────
init();
