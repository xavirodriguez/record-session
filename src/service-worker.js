
import * as screenshotService from './lib/screenshot-service.js';
import * as sessions from './lib/sessions.js';
import * as recordingStatus from './lib/recording-status.js';
import { ensureOriginPermission } from './lib/permissions.js';

/**
 * Service Worker Pro - Web Journey Recorder
 * V3 Standard
 */

const broadcastStatus = async (status) => {
  const finalStatus = status || await recordingStatus.getStatus();
  try {
    await chrome.runtime.sendMessage({ type: 'STATUS_UPDATED', payload: finalStatus });
  } catch (e) {
    // Suppress errors for when popup is not open
  }
};


chrome.runtime.onInstalled.addListener(() => {
  recordingStatus.updateStatus({ 
    isRecording: false, 
    isPaused: false, 
    sessionId: null, 
    startTime: null 
  }).then(broadcastStatus);

  chrome.contextMenus.create({
    id: "start-recording",
    title: "Grabar Journey aquí",
    contexts: ["all"]
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-recording") {
    const status = await recordingStatus.getStatus();
    if (status.isRecording) {
      handleStop();
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.startsWith('http')) {
        handleStart({ name: `Quick: ${new URL(tab.url).hostname}`, url: tab.url });
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    'START_RECORDING': () => handleStart(message.payload, sendResponse),
    'STOP_RECORDING': () => handleStop(sendResponse),
    'PAUSE_RECORDING': async () => {
      const newStatus = await recordingStatus.updateStatus({ isPaused: true });
      updateBadge(true, true);
      broadcastStatus(newStatus);
      sendResponse({ success: true });
    },
    'RESUME_RECORDING': async () => {
      const newStatus = await recordingStatus.updateStatus({ isPaused: false });
      updateBadge(true, false);
      broadcastStatus(newStatus);
      sendResponse({ success: true });
    },
    'ACTION_RECORDED': () => handleAction(message.payload, sender.tab),
    'GET_SESSIONS': () => sessions.getRecordingSessions().then(sendResponse),
    'GET_SCREENSHOT': () => screenshotService.getScreenshot(message.payload).then(sendResponse),
    'GET_STORAGE_INFO': () => screenshotService.getScreenshotStorageInfo().then(sendResponse),
    'CLEAR_STORAGE': () => {
      screenshotService.clearAllScreenshots().then(() => {
        updateBadge(false, false);
        sendResponse({ success: true });
      });
    },
    'DELETE_SESSION': () => sessions.deleteRecordingSession(message.payload).then(() => sendResponse({ success: true })),
    'DELETE_ACTION': () => sessions.deleteSessionAction(message.sessionId, message.actionId).then(() => sendResponse({ success: true })),
    'UPDATE_TITLE': () => sessions.updateSessionTitle(message.sessionId, message.title).then(() => sendResponse({ success: true })),
    'REORDER_ACTIONS': () => sessions.reorderSessionActions(message.sessionId, message.actions).then(() => sendResponse({ success: true }))
  };

  if (handlers[message.type]) handlers[message.type]();
  return true; 
});

async function updateBadge(isRecording, isPaused) {
  if (!isRecording) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  chrome.action.setBadgeText({ text: isPaused ? '||' : 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: isPaused ? '#f59e0b' : '#ef4444' });
}

async function handleStart(payload, sendResponse) {
  try {
    const hasPerm = await ensureOriginPermission(payload.url);
    if (!hasPerm) {
      if (sendResponse) sendResponse({ success: false, error: 'Permisos insuficientes' });
      return;
    }

    const session = await sessions.createRecordingSession(payload.name, payload.url);
    const newStatus = await recordingStatus.updateStatus({ isRecording: true, isPaused: false, sessionId: session.id, startTime: Date.now() });
    updateBadge(true, false);
    broadcastStatus(newStatus);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        const injected = await injectScripts(tab.id);
        if(!injected){
            if (sendResponse) sendResponse({ success: false, error: 'No se pudo inyectar el script en la página. Inténtalo de nuevo o recarga la pestaña.' });
            return;
        }
    }

    if (sendResponse) sendResponse({ success: true, sessionId: session.id });
  } catch (error) {
    if (sendResponse) sendResponse({ success: false, error: error.message });
  }
}

async function handleAction(action, tab) {
  const status = await recordingStatus.getStatus();
  if (!status.isRecording || status.isPaused) return;

  let screenshotId = null;
  let elementId = null;

  if (['click', 'navigation', 'submit', 'input'].includes(action.type)) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 40 });
      screenshotId = await screenshotService.storeScreenshot(dataUrl, tab.url, tab.id, status.sessionId);
      
      if (action.data.viewportRect) {
        const extractedBlob = await screenshotService.extractElementFromScreenshot(dataUrl, action.data.viewportRect);
        elementId = await screenshotService.storeExtractedElement(screenshotId, extractedBlob, action.data.viewportRect, action.data.tagName, action.data.text, action.id);
      }
    } catch (e) {}
  }

  await sessions.updateSessionActions(status.sessionId, { ...action, screenshotId, elementId });
}

async function handleStop(sendResponse) {
  const status = await recordingStatus.getStatus();
  const allSessions = await sessions.getRecordingSessions();
  const session = allSessions.find(s => s.id === status.sessionId);
  
  const newStatus = await recordingStatus.updateStatus({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  updateBadge(false, false);
  broadcastStatus(newStatus);

  if (sendResponse) sendResponse({ success: true, session });
}

async function injectScripts(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] });
        return true;
    } catch (e) {
        console.error(`Web Journey Recorder: Failed to inject content script in tab ${tabId}.`, e);
        await handleStop();
        return false;
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    recordingStatus.getStatus().then(status => {
      if (status.isRecording) injectScripts(tabId);
    });
  }
});
