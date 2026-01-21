
// Core service worker for the extension.
// Core service worker for the extension.
import * as screenshotService from '../lib/screenshot-service.js';
import * as sessions from '../lib/sessions.js';
import * as recordingStatus from '../lib/recording-status.js';
import { ensureOriginPermission } from '../lib/permissions.js';
import { ActionSchema } from '../lib/domain-schemas.js';

const CONFIG_KEY = 'webjourney_config';
const actionQueue = [];
let isProcessingQueue = false;

/**
 * Difunde el estado actual a todos los componentes de la extensión.
 */
async function broadcastStatusUpdate() {
  const status = await recordingStatus.getStatus();

  // Actualizar UI (popup/sidepanel)
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATED', payload: status }).catch(() => {});

  // Actualizar todos los content scripts en pestañas activas
  const tabs = await chrome.tabs.query({ status: 'complete' });
  for (const tab of tabs) {
    if (tab.id && tab.url?.startsWith('http')) {
      chrome.tabs.sendMessage(tab.id, { type: 'STATUS_UPDATED', payload: status }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await recordingStatus.updateStatus({
    isRecording: false, 
    isPaused: false, 
    sessionId: null, 
    startTime: null 
  });
  await broadcastStatusUpdate();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case 'START_RECORDING':
        return await handleStart(message.payload);
      case 'STOP_RECORDING':
        return await handleStop();
      case 'PAUSE_RECORDING':
        await recordingStatus.updateStatus({ isPaused: true });
        await broadcastStatusUpdate();
        updateBadge(true, true);
        return { success: true };
      case 'RESUME_RECORDING':
        await recordingStatus.updateStatus({ isPaused: false });
        await broadcastStatusUpdate();
        updateBadge(true, false);
        return { success: true };
      case 'ACTION_RECORDED':
        const validation = ActionSchema.safeParse(message.payload);
        if (!validation.success) return { success: false, error: "Invalid action schema" };
        actionQueue.push({ action: validation.data, tab: sender.tab });
        processQueue();
        return { success: true };
      case 'GET_SESSIONS':
        // Ahora devuelve solo Metadatos (O(N) ligero)
        return await sessions.getSessionsMetadata();
      case 'GET_SESSION_ACTIONS':
        // Devuelve las acciones de una sesión específica (O(M) shard)
        return await sessions.getSessionActions(message.payload);
      case 'GET_SCREENSHOT':
        return await screenshotService.getScreenshot(message.payload);
      case 'GET_SCREENSHOTS_BATCH':
        return await screenshotService.getScreenshotsBatch(message.payload);
      case 'GET_STORAGE_INFO':
        return await screenshotService.getScreenshotStorageInfo();
      case 'CLEAR_STORAGE':
        await screenshotService.clearAllScreenshots();
        // También limpiar sesiones
        await sessions.clearAllSessions();
        updateBadge(false, false);
        return { success: true };
      case 'DELETE_SESSION':
        await sessions.deleteRecordingSession(message.payload);
        return { success: true };
      case 'DELETE_ACTION':
        await sessions.deleteSessionAction(message.payload.sessionId, message.payload.actionId);
        return { success: true };
      case 'UPDATE_TITLE':
        await sessions.updateSessionTitle(message.payload.sessionId, message.payload.title);
        return { success: true };
      case 'REORDER_ACTIONS':
        await sessions.reorderSessionActions(message.payload.sessionId, message.payload.actions);
        return { success: true };
      case 'GET_STATUS':
        return await recordingStatus.getStatus();
      case 'GET_CONFIG':
        const result = await chrome.storage.local.get(CONFIG_KEY);
        return result[CONFIG_KEY] || {};
      case 'SAVE_CONFIG':
        await chrome.storage.local.set({ [CONFIG_KEY]: message.payload });
        return { success: true };
      default:
        return null;
    }
  };

  handle().then(sendResponse);
  return true; 
});

async function processQueue() {
  if (isProcessingQueue || actionQueue.length === 0) return;
  isProcessingQueue = true;
  while (actionQueue.length > 0) {
    const { action, tab } = actionQueue.shift();
    try {
      await handleAction(action, tab);
    } catch (e) {
      console.error("Error procesando acción:", e);
    }
  }
  isProcessingQueue = false;
}

async function updateBadge(isRecording, isPaused) {
  if (!isRecording) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  chrome.action.setBadgeText({ text: isPaused ? '||' : 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: isPaused ? '#f59e0b' : '#ef4444' });
}

async function handleStart(payload) {
  try {
    const hasPerm = await ensureOriginPermission(payload.url);
    if (!hasPerm) return { success: false, error: 'Permisos denegados' };
    
    const session = await sessions.createRecordingSession(payload.name, payload.url);
    await recordingStatus.updateStatus({ isRecording: true, isPaused: false, sessionId: session.id, startTime: Date.now() });
    updateBadge(true, false);
    await broadcastStatusUpdate();
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      injectScripts(tab.id);
    }
    
    return { success: true, sessionId: session.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleAction(action, tab) {
  const status = await recordingStatus.getStatus();
  if (!status.isRecording || status.isPaused) return;

  let screenshotId = null;
  let elementId = null;

  if (['click', 'input', 'submit'].includes(action.type) && tab?.id) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 30 });
      screenshotId = await screenshotService.storeScreenshot(dataUrl, tab.url, tab.id, status.sessionId);
      if (action.data?.viewportRect) {
        const db = await screenshotService.openDatabase();
        const screenshotObj = await new Promise(r => {
          const req = db.transaction('screenshots').objectStore('screenshots').get(screenshotId);
          req.onsuccess = () => r(req.result);
        });
        if (screenshotObj?.data) {
          const extractedBlob = await screenshotService.extractElementFromScreenshot(screenshotObj.data, action.data.viewportRect);
          elementId = await screenshotService.storeExtractedElement(screenshotId, extractedBlob, action.data.viewportRect, action.data.tagName, action.data.text, action.id);
        }
      }
    } catch (e) {}
  }

  await sessions.updateSessionActions(status.sessionId, { ...action, screenshotId, elementId });
}

async function handleStop() {
  const status = await recordingStatus.getStatus();
  const metadataList = await sessions.getSessionsMetadata();
  const sessionMeta = metadataList.find(s => s.id === status.sessionId);

  await recordingStatus.updateStatus({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  updateBadge(false, false);
  await broadcastStatusUpdate();
  
  // Obtenemos las acciones para el retorno completo al cerrar
  const actions = await sessions.getSessionActions(status.sessionId);
  return { success: true, session: { ...sessionMeta, actions } };
}

async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content-script.js'] });
  } catch (e) {}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    recordingStatus.getStatus().then(status => {
      if (status.isRecording) {
        injectScripts(tabId);
      }
    });
  }
});
