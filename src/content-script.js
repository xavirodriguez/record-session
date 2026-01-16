
/**
 * Web Journey Recorder - Content Script Pro
 */

(function() {
  if (window.WebJourneyInjected) return;
  window.WebJourneyInjected = true;

  let isRecording = false;
  let sessionId = null;

  const updateState = (status) => {
    isRecording = status.isRecording && !status.isPaused;
    sessionId = status.sessionId;
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATUS_UPDATED') {
      updateState(message.payload);
    }
  });

  // Request initial state on injection
  chrome.storage.local.get(['webjourney_status'], (res) => {
    if (res.webjourney_status) updateState(res.webjourney_status);
  });

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
        id: 'act_' + Date.now(),
        type,
        timestamp: Date.now(),
        data: { ...info, ...extra }
      }
    }).catch((e) => {
        console.error("Web Journey Recorder: Could not send message to service worker.", e);
    });
  };

  document.addEventListener('mousedown', (e) => {
    if (!isRecording) return;
    const target = e.target.closest('button, a, input, [role="button"]') || e.target;
    record('click', target);
  }, true);

  document.addEventListener('change', (e) => {
    if (!isRecording) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      record('input', e.target, { value: e.target.type === 'password' ? '***' : e.target.value });
    }
  }, true);

  console.log("Web Journey Pro: Script activo.");
})();
