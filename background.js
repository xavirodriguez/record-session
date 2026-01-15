
import * as screenshotService from './screenshotService.js';
import * as sessions from './sessions.js';
import * as recordingStatus from './recordingStatus.js';
import { ensureOriginPermission } from './permissions.js';

/**
 * Service Worker de la Extensión
 * Centraliza la comunicación entre los Content Scripts y el Popup.
 */

let lastPingTime = {};

// Inicialización al instalar/actualizar
chrome.runtime.onInstalled.addListener(() => {
  recordingStatus.updateStatus({ 
    isRecording: false, 
    isPaused: false, 
    sessionId: null, 
    startTime: null 
  });
  console.log("Web Journey Recorder Pro: Instalado correctamente.");
});

// Router de Mensajes centralizado
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    'START_RECORDING': () => handleStart(message.payload, sendResponse),
    'STOP_RECORDING': () => handleStop(sendResponse),
    'PAUSE_RECORDING': () => recordingStatus.updateStatus({ isPaused: true }).then(() => sendResponse({ success: true })),
    'RESUME_RECORDING': () => recordingStatus.updateStatus({ isPaused: false }).then(() => sendResponse({ success: true })),
    'ACTION_RECORDED': () => handleAction(message.payload, sender.tab),
    'PING_HEARTBEAT': () => { lastPingTime[message.sessionId] = Date.now(); },
    'GET_SESSIONS': () => sessions.getRecordingSessions().then(sendResponse),
    'GET_SCREENSHOT': () => screenshotService.getScreenshot(message.payload).then(sendResponse),
    'GET_STORAGE_INFO': () => screenshotService.getScreenshotStorageInfo().then(sendResponse),
    'CLEAR_STORAGE': () => screenshotService.clearAllScreenshots().then(() => sendResponse({ success: true })),
    'DELETE_SESSION': () => sessions.deleteRecordingSession(message.payload).then(() => sendResponse({ success: true })),
    'DELETE_ACTION': () => sessions.deleteSessionAction(message.sessionId, message.actionId).then(() => sendResponse({ success: true })),
    'UPDATE_TITLE': () => sessions.updateSessionTitle(message.sessionId, message.title).then(() => sendResponse({ success: true })),
    'REORDER_ACTIONS': () => sessions.reorderSessionActions(message.sessionId, message.actions).then(() => sendResponse({ success: true }))
  };

  if (handlers[message.type]) {
    handlers[message.type]();
  }
  
  return true; // Mantiene el canal abierto para respuestas asíncronas
});

async function handleStart(payload, sendResponse) {
  try {
    const hasPerm = await ensureOriginPermission(payload.url);
    if (!hasPerm) {
      sendResponse({ success: false, error: 'Permisos de origen denegados.' });
      return;
    }

    const session = await sessions.createRecordingSession(payload.name, payload.url);
    
    // Acción de inicio (RF-04)
    const launchAction = {
      id: 'act_launch_' + Date.now(),
      type: 'LaunchUrl',
      timestamp: Date.now(),
      data: { url: payload.url, selector: 'window', tagName: 'BROWSER' }
    };
    await sessions.updateSessionActions(session.id, launchAction);

    await recordingStatus.updateStatus({ 
      isRecording: true, 
      isPaused: false, 
      sessionId: session.id, 
      startTime: Date.now() 
    });
    
    // Inyectar en pestaña actual si es necesario
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) injectScripts(tab.id);

    sendResponse({ success: true, sessionId: session.id });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAction(action, tab) {
  const status = await recordingStatus.getStatus();
  if (!status.isRecording || status.isPaused) return;

  let screenshotId = null;
  let elementId = null;

  // Solo capturar imágenes en acciones clave para ahorrar recursos
  const highValueActions = ['click', 'navigation', 'submit', 'input', 'LaunchUrl'];
  if (highValueActions.includes(action.type)) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 40 });
      screenshotId = await screenshotService.storeScreenshot(dataUrl, tab.url, tab.id, status.sessionId);
      
      if (action.data.viewportRect) {
        const db = await screenshotService.openDatabase();
        const screenshotObj = await new Promise(r => {
          const req = db.transaction('screenshots').objectStore('screenshots').get(screenshotId);
          req.onsuccess = () => r(req.result);
        });
        
        if (screenshotObj && screenshotObj.data) {
          const extractedBlob = await screenshotService.extractElementFromScreenshot(screenshotObj.data, action.data.viewportRect);
          elementId = await screenshotService.storeExtractedElement(screenshotId, extractedBlob, action.data.viewportRect, action.data.tagName, action.data.text, action.id);
        }
      }
    } catch (e) {
      console.warn("Captura fallida:", e);
    }
  }

  await sessions.updateSessionActions(status.sessionId, { ...action, screenshotId, elementId });
}

async function handleStop(sendResponse) {
  const status = await recordingStatus.getStatus();
  const allSessions = await sessions.getRecordingSessions();
  const session = allSessions.find(s => s.id === status.sessionId);
  
  await recordingStatus.updateStatus({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  sendResponse({ success: true, session });
}

async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({ 
      target: { tabId }, 
      files: ['content.js'] 
    });
  } catch (e) {
    // Silenciar errores en páginas restringidas
  }
}

// Inyectar al navegar
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    recordingStatus.getStatus().then(status => {
      if (status.isRecording) injectScripts(tabId);
    });
  }
});

// Monitor de salud de la sesión (Stale check)
setInterval(async () => {
  const status = await recordingStatus.getStatus();
  if (status.isRecording && !status.isPaused && status.sessionId) {
    const lastPing = lastPingTime[status.sessionId];
    if (lastPing && (Date.now() - lastPing > 15000)) {
      recordingStatus.updateStatus({ isPaused: true, stale: true });
    }
  }
}, 10000);
