const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Recording
  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),

  // AI
  transcribe: (args) => ipcRenderer.invoke("transcribe", args),
  summarize: (args) => ipcRenderer.invoke("summarize", args),

  // Tasks (persisted to disk)
  loadTasks: () => ipcRenderer.invoke("load-tasks"),
  saveTasks: (tasks) => ipcRenderer.invoke("save-tasks", tasks),

  // Meeting history
  loadMeetings: () => ipcRenderer.invoke("load-meetings"),
  saveMeeting: (meeting) => ipcRenderer.invoke("save-meeting", meeting),

  // Settings (API keys etc)
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
});
