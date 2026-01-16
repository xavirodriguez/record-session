
/**
 * Web Journey Recorder Pro - Content Script
 * Captura avanzada de interacciones y tráfico de Red
 */

(function() {
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;

  // Sincronizar estado con el almacenamiento local
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

  const recordAction = (type, target, extra = {}) => {
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

  // --- INTERCEPCIÓN DE RED (INYECTADO EN EL CONTEXTO DE LA PÁGINA) ---
  const injectNetworkInterceptor = () => {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const originalFetch = window.fetch;
        const originalXHROpen = window.XMLHttpRequest.prototype.open;
        const originalXHRSend = window.XMLHttpRequest.prototype.send;

        const reportNetwork = (method, url, type, status) => {
          // Evitar ruido de analytics o de la propia extensión
          if (url.includes('google-analytics') || url.startsWith('chrome-extension://')) return;
          
          window.dispatchEvent(new CustomEvent('wj_pro_network_event', {
            detail: { method, url, type, status, timestamp: Date.now() }
          }));
        };

        // Interceptar Fetch
        window.fetch = async (...args) => {
          try {
            const response = await originalFetch(...args);
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            const method = args[1]?.method || 'GET';
            reportNetwork(method, url, 'fetch', response.status);
            return response;
          } catch (err) {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            reportNetwork(args[1]?.method || 'GET', url, 'fetch', 'FAILED');
            throw err;
          }
        };

        // Interceptar XHR
        window.XMLHttpRequest.prototype.open = function(method, url) {
          this._wj_method = method;
          this._wj_url = url;
          return originalXHROpen.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.send = function() {
          this.addEventListener('load', () => {
            reportNetwork(this._wj_method, this._wj_url, 'xhr', this.status);
          });
          this.addEventListener('error', () => {
            reportNetwork(this._wj_method, this._wj_url, 'xhr', 'FAILED');
          });
          return originalXHRSend.apply(this, arguments);
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  };

  injectNetworkInterceptor();

  // Escuchar eventos de red desde la página
  window.addEventListener('wj_pro_network_event', (e) => {
    if (isRecording) {
      recordAction('network', null, { 
        url: e.detail.url, 
        method: e.detail.method, 
        status: e.detail.status,
        apiType: e.detail.type 
      });
    }
  });

  // --- CAPTURA DE INTERACCIONES UI ---
  document.addEventListener('mousedown', (e) => {
    if (!isRecording) return;
    const target = e.target.closest('button, a, input, select, [role="button"]') || e.target;
    recordAction('click', target);
  }, true);

  document.addEventListener('change', (e) => {
    if (!isRecording) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      recordAction('input', e.target, { 
        value: e.target.type === 'password' ? '***' : e.target.value 
      });
    }
  }, true);

  console.log("Web Journey Pro: Network & UI Engine Inyectado.");
})();
