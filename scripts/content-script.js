
/**
 * Web Journey Recorder Pro - Content Script
 * Blindado para captura de Red y UI
 */

(function() {
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;

  const syncState = () => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get(['webjourney_status'], (res) => {
      const status = res.webjourney_status || {};
      isRecording = status.isRecording && !status.isPaused;
      sessionId = status.sessionId;
    });
  };

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.webjourney_status) syncState();
    });
    syncState();
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

  // --- INTERCEPCIÓN DE RED PRO ---
  const injectNetworkInterceptor = () => {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const originalFetch = window.fetch;
        const originalXHROpen = window.XMLHttpRequest.prototype.open;
        const originalXHRSend = window.XMLHttpRequest.prototype.send;

        const reportNetwork = (method, url, type, status) => {
          if (!url || url.includes('google-analytics') || url.startsWith('chrome-extension://') || url.includes('/livereload')) return;
          
          window.dispatchEvent(new CustomEvent('wj_pro_network_event', {
            detail: { method, url, type, status, timestamp: Date.now() }
          }));
        };

        window.fetch = async (...args) => {
          let method = 'GET';
          let url = '';
          if (typeof args[0] === 'string') { url = args[0]; }
          else if (args[0] instanceof Request) { url = args[0].url; method = args[0].method; }
          if (args[1]?.method) method = args[1].method;

          try {
            const response = await originalFetch(...args);
            reportNetwork(method, url, 'fetch', response.status);
            return response;
          } catch (err) {
            reportNetwork(method, url, 'fetch', 'FAILED');
            throw err;
          }
        };

        window.XMLHttpRequest.prototype.open = function(method, url) {
          this._wj_method = method;
          this._wj_url = url;
          return originalXHROpen.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.send = function() {
          this.addEventListener('load', () => reportNetwork(this._wj_method, this._wj_url, 'xhr', this.status));
          this.addEventListener('error', () => reportNetwork(this._wj_method, this._wj_url, 'xhr', 'FAILED'));
          return originalXHRSend.apply(this, arguments);
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  };

  injectNetworkInterceptor();

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

  console.log("Web Journey Pro: Monitor Full-Stack Activo.");
})();
