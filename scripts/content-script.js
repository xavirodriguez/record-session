
/**
 * Web Journey Recorder - Content Script Pro
 * Captura de interacciones y llamadas de Red (API Interception)
 */

(function() {
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;

  const syncState = () => {
    chrome.storage.local.get(['webjourney_status'], (res) => {
      const status = res.webjourney_status || {};
      isRecording = status.isRecording && !status.isPaused;
      sessionId = status.sessionId;
    });
  };

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.webjourney_status) syncState();
  });

  syncState();

  const getElementInfo = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
      tagName: el.tagName,
      text: (el.innerText || el.value || "").slice(0, 50).trim(),
      viewportRect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  };

  const record = (type, target, extra = {}) => {
    if (!isRecording) return;
    const info = target ? getElementInfo(target) : { selector: 'window' };
    
    chrome.runtime.sendMessage({
      type: 'ACTION_RECORDED',
      payload: {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type,
        timestamp: Date.now(),
        data: { ...info, ...extra }
      }
    }).catch(() => {}); 
  };

  // --- INTERCEPCIÓN DE RED (INYECTADO EN MAIN WORLD) ---
  const injectNetworkInterceptor = () => {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const originalFetch = window.fetch;
        const originalXHR = window.XMLHttpRequest.prototype.open;
        const originalXHRSend = window.XMLHttpRequest.prototype.send;

        const notifyNetwork = (method, url, type, status) => {
          // Filtrar llamadas de extensiones o analytics ruidosos si es necesario
          if (url.includes('chrome-extension://') || url.includes('google-analytics')) return;
          
          window.dispatchEvent(new CustomEvent('wj_network_call', {
            detail: { method, url, type, status, timestamp: Date.now() }
          }));
        };

        window.fetch = async (...args) => {
          const response = await originalFetch(...args);
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;
          const method = args[1]?.method || 'GET';
          notifyNetwork(method, url, 'fetch', response.status);
          return response;
        };

        window.XMLHttpRequest.prototype.open = function(method, url) {
          this._method = method;
          this._url = url;
          return originalXHR.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.send = function() {
          this.addEventListener('load', () => {
            notifyNetwork(this._method, this._url, 'xhr', this.status);
          });
          return originalXHRSend.apply(this, arguments);
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  };

  injectNetworkInterceptor();

  // Escuchar eventos de red desde el MAIN world
  window.addEventListener('wj_network_call', (e) => {
    if (isRecording) {
      record('network', null, { 
        url: e.detail.url, 
        method: e.detail.method, 
        status: e.detail.status,
        apiType: e.detail.type 
      });
    }
  });

  // --- EVENTOS DE USUARIO ---
  document.addEventListener('mousedown', (e) => {
    if (!isRecording) return;
    const target = e.target.closest('button, a, input, [role="button"]') || e.target;
    record('click', target);
  }, true);

  document.addEventListener('change', (e) => {
    if (!isRecording) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      record('input', e.target, { value: e.target.type === 'password' ? '***' : e.target.value });
    }
  }, true);

  console.log("Web Journey Pro: Script de grabación y red activo.");
})();
