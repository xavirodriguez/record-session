
import { z } from "zod";
import { SessionSchema, CreateSessionInputSchema } from "./domain-schemas.js";

const RECORDING_SESSIONS_KEY = 'webjourney_recording_sessions';
const SessionsArraySchema = z.array(SessionSchema);

/**
 * Recupera todas las sesiones almacenadas y las valida contra el esquema de dominio.
 * @returns {Promise<z.infer<typeof SessionSchema>[]>}
 */
export async function getRecordingSessions() {
  try {
    const result = await chrome.storage.local.get(RECORDING_SESSIONS_KEY);
    const rawData = result[RECORDING_SESSIONS_KEY] || [];
    // Normalización y validación automática de datos antiguos o corruptos
    return SessionsArraySchema.parse(rawData);
  } catch (e) {
    console.error("Dominio corrupto detectado en storage:", e);
    return [];
  }
}

/**
 * Crea una nueva sesión de grabación validando los inputs de frontera.
 * @param {string} title 
 * @param {string} url 
 */
export async function createRecordingSession(title, url) {
  // 1. Validar inputs de entrada
  const input = CreateSessionInputSchema.parse({ name: title, url });
  
  const sessions = await getRecordingSessions();
  
  // 2. Construir objeto de dominio usando el esquema para garantizar consistencia
  const newSession = SessionSchema.parse({
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: input.name || `Grabación ${sessions.length + 1}`,
    url: input.url || null,
    createdDate: new Date().toISOString(),
    status: 'active',
    actions: []
  });

  sessions.unshift(newSession);
  const limitedSessions = sessions.slice(0, 50);
  
  await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: limitedSessions });
  return newSession;
}

/**
 * Agrega una acción a una sesión específica.
 * @param {string} sessionId 
 * @param {import("./domain-schemas.js").Action} action 
 */
export async function updateSessionActions(sessionId, action) {
  if (!sessionId) return;

  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  
  if (index !== -1) {
    // Validamos que la acción sea legal según el dominio antes de insertarla
    const validatedAction = ActionSchema.parse(action);
    
    const isDuplicate = sessions[index].actions.some(a => a.id === validatedAction.id);
    if (!isDuplicate) {
      sessions[index].actions.push(validatedAction);
      await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
    }
  }
}

/**
 * Actualiza el título de una sesión.
 */
export async function updateSessionTitle(sessionId, title) {
  const sessions = await getRecordingSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].title = z.string().min(1).parse(title);
    await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: sessions });
  }
}

/**
 * Elimina una sesión.
 */
export async function deleteRecordingSession(sessionId) {
  const sessions = await getRecordingSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ [RECORDING_SESSIONS_KEY]: filtered });
}
