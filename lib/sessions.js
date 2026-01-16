
const RECORDING_SESSIONS_KEY = 'webjourney_recording_sessions';

export async function getRecordingSessions() {
  const result = await chrome.storage.local.get(RECORDING_SESSIONS_KEY);
  return result[RECORDING_SESSIONS_KEY] || [];
}

export async function createRecordingSession(title, url) {
  const sessions = await getRecordingSessions();
  const newSession = {
    id: 'session_' + Date.now(),
    title: title || `Recording ${sessions.length + 1}`,
    url: url || null,
    createdDate: new Date().toISOString(),
    status: 'active',
    actions: []
  };
  sessions.unshift(newSession);
  await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  return newSession;
}

export async function updateSessionActions(sessionId, action) {
  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].actions.push(action);
    await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  }
}

export async function reorderSessionActions(sessionId, actions) {
  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].actions = actions;
    await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  }
}

export async function updateSessionTitle(sessionId, title) {
  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].title = title;
    await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  }
}

export async function deleteSessionAction(sessionId, actionId) {
  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].actions = sessions[index].actions.filter(a => a.id !== actionId);
    await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  }
}

export async function deleteRecordingSession(sessionId) {
  const sessions = await getRecordingSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: filtered });
}
