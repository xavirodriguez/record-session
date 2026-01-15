
const STATUS_KEY = 'webjourney_status';

export async function getStatus() {
  const res = await chrome.storage.local.get(STATUS_KEY);
  return res[STATUS_KEY] || { isRecording: false, isPaused: false, sessionId: null, startTime: null };
}

export async function updateStatus(update) {
  const current = await getStatus();
  const next = { ...current, ...update };
  await chrome.storage.local.set({ [STATUS_KEY]: next });
  const tabs = await chrome.tabs.query({});
  tabs.forEach(t => {
    chrome.tabs.sendMessage(t.id, { action: 'updateState', state: next }).catch(() => {});
  });
}
