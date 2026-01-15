
/**
 * Web Journey Recorder - Content Script
 * Este script se inyecta en cada página visitada para detectar interacciones del usuario.
 */

(function() {
  // Evitar inyecciones duplicadas
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;
  let heartbeatInterval = null;

  // Sincronización del estado desde chrome.storage
  const syncState = () => {
    chrome.storage.local.get(['webjourney_status'], (res) => {
      const status = res.webjourney_status || {};
      const newRecordingState = status.isRecording && !status.isPaused;
      
      if (newRecordingState !== isRecording || status.sessionId !== sessionId) {
        isRecording = newRecordingState;
        sessionId = status.sessionId;
        manageHeartbeat();
      }
    });
  };

  // Heartbeat para mantener la sesión viva y detectar cierres (RF-08)
  const manageHeartbeat = () => {
    if (isRecording && !heartbeatInterval) {
      heartbeatInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'PING_HEARTBEAT', sessionId }).catch(() => {
          // Si falla el mensaje, el background podría estar dormido o la extensión deshabilitada
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        });
      }, 3000);
    } else if (!isRecording && heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  // Escuchar cambios en el almacenamiento global
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.webjourney_status) {
      syncState();
    }
  });

  // Inicialización
  syncState();

  /**
   * Captura información detallada del elemento DOM
   */
  const getElementInfo = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      selector: getSmartSelector(el),
      tagName: el.tagName,
      text: (el.innerText || el.value || el.ariaLabel || "").slice(0, 60).trim(),
      viewportRect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  };

  /**
   * Genera un selector legible para humanos e IA
   */
  const getSmartSelector = (el) => {
    if (el.id) return `#${el.id}`;
    const attrs = ['data-testid', 'data-qa', 'aria-label', 'name', 'placeholder', 'role'];
    for (let attr of attrs) {
      const val = el.getAttribute(attr);
      if (val) return `${el.tagName.toLowerCase()}[${attr}="${val}"]`;
    }
    // Fallback: clases o jerarquía simple
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.split(' ')[0];
      if (firstClass) return `${el.tagName.toLowerCase()}.${firstClass}`;
    }
    return el.tagName.toLowerCase();
  };

  /**
   * Envía la acción grabada al Service Worker
   */
  const record = (type, target, extra = {}) => {
    if (!isRecording) return;
    
    const info = target ? getElementInfo(target) : { selector: 'window', tagName: 'WINDOW' };
    
    chrome.runtime.sendMessage({
      type: 'ACTION_RECORDED',
      payload: {
        id: 'act_' + Date.now() + Math.random().toString(36).substr(2, 4),
        type,
        timestamp: Date.now(),
        data: { ...info, ...extra }
      }
    });
  };

  // --- Listeners de Eventos del DOM ---

  // Captura de clicks con delegación
  document.addEventListener('mousedown', (e) => {
    if (!isRecording) return;
    const target = e.target.closest('button, a, input, [role="button"], [role="link"], summary') || e.target;
    record('click', target);
  }, true);

  // Captura de cambios en inputs (debounced implícito al perder foco o cambiar)
  document.addEventListener('change', (e) => {
    if (!isRecording) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      record('input', e.target, { value: e.target.type === 'password' ? '********' : e.target.value });
    }
  }, true);

  // Monitor de navegación SPA (History API)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      record('navigation', null, { url: lastUrl });
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });

  // Escuchar mensajes directos (pings de depuración o limpieza)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'pingScripts') {
      sendResponse({ success: true, version: '1.2.0' });
    }
    if (msg.action === 'updateState') {
      syncState();
    }
  });

  console.log("Web Journey Content Script: Inyectado y listo.");
})();
