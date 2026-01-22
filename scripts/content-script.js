
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

  const sanitizeHTML = (str) => {
    if (!str) return '';
    return str.replace(/<\/?[^>]+(>|$)/g, "");
  };

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
        text: sanitizeHTML((el.innerText || el.value || "")).slice(0, 50).trim(),
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

  // Interceptación de Red (Fetch y XHR)
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    if (isRecording) {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');
      recordNetworkAction(url, method, 'fetch');
    }
    return originalFetch.apply(this, args);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (isRecording) {
      // 🛡️ Mover la intercepción a .open() para consistencia de timing con fetch.
      recordNetworkAction(url, method, 'xhr');
    }
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    // La lógica de grabación ya se movió a .open.
    // Mantenemos este patch por si se necesita lógica adicional en el futuro.
    return originalXhrSend.apply(this, args);
  };

  const recordNetworkAction = (url, method, apiType) => {
    if (url.startsWith('chrome-extension://')) return;

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
            type: 'ACTION_RECORDED',
            payload: {
                id: 'net_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'network',
                timestamp: Date.now(),
                data: {
                    url,
                    method,
                    apiType,
                    selector: 'network',
                    status: 'Requesting'
                }
            }
        }).catch(e => {});
    }
  };

})();
