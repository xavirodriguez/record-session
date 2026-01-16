
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
  // Zod se encarga de mezclar y validar el estado resultante
  const next = RecordingStatusSchema.parse({ ...current, ...update });
  
  await chrome.storage.local.set({ [STATUS_KEY]: next });
  
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'updateState', state: next }).catch(() => {});
      }
    }
  } catch (e) {}
}
