
import { RecordingStatusSchema } from "./domain-schemas.js";

const STATUS_KEY = 'webjourney_status';

/**
 * Obtiene el estado actual de la grabación validado.
 */
export async function getStatus() {
  const res = await chrome.storage.local.get(STATUS_KEY);
  const raw = res[STATUS_KEY] || {};
  return RecordingStatusSchema.parse(raw);
}

/**
 * Actualiza el estado global garantizando que la mutación parcial sea legal.
 */
export async function updateStatus(update) {
  const current = await getStatus();
  const next = RecordingStatusSchema.parse({ ...current, ...update });
  
  await chrome.storage.local.set({ [STATUS_KEY]: next });
  
  // 1. Notificar a los componentes de la extensión (popup, panel, etc.)
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATED', payload: next }).catch(() => {});

  // 2. Notificar a TODOS los content scripts en pestañas activas
  const tabs = await chrome.tabs.query({ status: 'complete' });
  for (const tab of tabs) {
    if (tab.id && tab.url?.startsWith('http')) {
      chrome.tabs.sendMessage(tab.id, { type: 'STATUS_UPDATED', payload: next })
        .catch(() => {}); // Ignorar errores si el script no está inyectado
    }
  }
}
