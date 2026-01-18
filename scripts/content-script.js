
/**
 * Web Journey Recorder Pro - Content Script
 * This script is injected into pages to record user interactions.
 * Blindado para captura de Red y UI
 */

(function() {
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;

  // Escuchar actualizaciones de estado desde el service worker
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATUS_UPDATED') {
        const status = message.payload || {};
        isRecording = status.isRecording && !status.isPaused;
        sessionId = status.sessionId;
      }
    });
  }

  // Solicitar estado inicial al inyectarse
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
       if(status) {
        isRecording = status.isRecording && !status.isPaused;
        sessionId = status.sessionId;
      }
    });
  }

  const getElementInfo = (el) => {
    if (!el) return null;
    try {
      const rect = el.getBoundingClientRect();
      return {
        selector: el.id ? `#${el.id}` : el.tagName?.toLowerCase() || 'unknown',
        tagName: el.tagName || 'UNKNOWN',
        text: (el.innerText || el.value || "").slice(0, 50).trim(),
        viewportRect: {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    } catch(e) { return null; }
  };

  const recordAction = (type, target, extra = {}) => {
    if (!isRecording) return;
    const info = target ? getElementInfo(target) : { selector: 'window' };
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'ACTION_RECORDED',
        payload: {
          id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          type,
          timestamp: Date.now(),
          data: { ...info, ...extra }
        }
      }).catch(() => {}); 
    }
  };


  const recordNetworkAction = (api, method, url) => {
    // Filtrar URLs irrelevantes
    if (url.startsWith('chrome-extension://') || url.startsWith('data:')) return;

    recordAction('network', window, {
      url,
      method: method.toUpperCase(),
      status: 'Requesting',
      apiType: api,
      selector: 'network'
    });
  };

  // Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    if (isRecording) {
      let url, method = 'GET';
      if (args[0] instanceof Request) {
        url = args[0].url;
        method = args[0].method;
      } else {
        url = args[0];
        if (args[1] && args[1].method) {
          method = args[1].method;
        }
      }
      recordNetworkAction('fetch', method, url);
    }
    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (isRecording) {
      // Record the network action immediately, similar to fetch
      recordNetworkAction('xhr', method, url);
    }
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  document.addEventListener('click', (e) => {
    if (!isRecording) return;
    const target = e.target.closest('button, a, input, select, [role="button"]') || e.target;
    recordAction('click', target);
  }, true);

  document.addEventListener('submit', (e) => {
      if (!isRecording) return;
      recordAction('submit', e.target);
  }, true);

  document.addEventListener('change', (e) => {
    if (!isRecording) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      recordAction('input', e.target, { 
        value: e.target.type === 'password' ? '***' : e.target.value 
      });
    }
  }, true);

  console.log("Web Journey Pro: Monitor Full-Stack Activo.");
})();
