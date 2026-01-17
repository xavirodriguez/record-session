
// Core service worker for the extension.
import * as screenshotService from '../lib/screenshot-service.js';
import * as sessions from '../lib/sessions.js';
import * as recordingStatus from '../lib/recording-status.js';
import { ensureOriginPermission } from '../lib/permissions.js';
import { ActionSchema } from '../lib/domain-schemas.js';

const actionQueue = [];
let isProcessingQueue = false;

chrome.runtime.onInstalled.addListener(() => {
  recordingStatus.updateStatus({ 
    isRecording: false, 
    isPaused: false, 
    sessionId: null, 
    startTime: null 
  });
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
        updateBadge(true, true);
        return { success: true };
      case 'RESUME_RECORDING':
        await recordingStatus.updateStatus({ isPaused: false });
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
      case 'GET_STORAGE_INFO':
        return await screenshotService.getScreenshotStorageInfo();
      case 'CLEAR_STORAGE':
        await screenshotService.clearAllScreenshots();
        updateBadge(false, false);
        return { success: true };
      case 'GET_STATUS':
        return await recordingStatus.getStatus();
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
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await attachDebugger(tab.id);
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

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await detachDebugger(tab.id);

  await recordingStatus.updateStatus({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  updateBadge(false, false);
  
  // Obtenemos las acciones para el retorno completo al cerrar
  const actions = await sessions.getSessionActions(status.sessionId);
  return { success: true, session: { ...sessionMeta, actions } };
}

async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['scripts/content-script.js'] });
  } catch (e) {}
}

const DEBUGGER_VERSION = "1.3";
let attachedTabs = new Set();

async function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    attachedTabs.add(tabId);
  } catch (e) {
    console.warn(`No se pudo adjuntar el depurador a la pestaña ${tabId}:`, e.message);
  }
}

async function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
    attachedTabs.delete(tabId);
  } catch (e) {
    console.warn(`No se pudo separar el depurador de la pestaña ${tabId}:`, e.message);
  }
}

function handleDetach(source, reason) {
  if (source.tabId) attachedTabs.delete(source.tabId);
}

async function handleEvent(source, method, params) {
    if (method === 'Network.requestWillBeSent') {
        const status = await recordingStatus.getStatus();
        if (!status.isRecording || status.isPaused) return;

        const { requestId, request } = params;
        const { url, method: httpMethod } = request;

        // Filtrar URLs irrelevantes
        if (url.startsWith('chrome-extension://') || url.startsWith('data:')) return;

        const action = {
            id: 'net_' + requestId,
            type: 'network',
            timestamp: Date.now(),
            data: {
                url,
                method: httpMethod,
                status: 'Requesting',
                apiType: 'fetch/xhr',
                selector: 'network'
            }
        };

        // Utilizar la cola de acciones existente para almacenar la acción de red
        actionQueue.push({ action, tab: { id: source.tabId } });
        processQueue();
    }
}

chrome.debugger.onEvent.addListener(handleEvent);
chrome.debugger.onDetach.addListener(handleDetach);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    recordingStatus.getStatus().then(status => {
      if (status.isRecording) {
        injectScripts(tabId);
        attachDebugger(tabId);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detachDebugger(tabId);
});
