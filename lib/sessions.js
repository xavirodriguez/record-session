
import { z } from "zod";
import { SessionMetadataSchema, SessionSchema, ActionSchema, CreateSessionInputSchema } from "./domain-schemas.js";

const METADATA_KEY = 'webjourney_sessions_metadata';
const OLD_SESSIONS_KEY = 'webjourney_recording_sessions';
const ACTIONS_PREFIX = 'webjourney_actions_';

/**
 * Migra datos del formato antiguo (monolítico) al nuevo (sharded)
 */
async function migrateIfNeeded() {
  const oldData = await chrome.storage.local.get(OLD_SESSIONS_KEY);
  if (!oldData[OLD_SESSIONS_KEY]) return;

  console.log("Iniciando migración de almacenamiento a modelo fragmentado...");
  const oldSessions = oldData[OLD_SESSIONS_KEY];
  const metadataList = [];
  const shards = {};

  for (const session of oldSessions) {
    const { actions, ...metadata } = session;
    metadataList.push({ ...metadata, actionCount: actions.length });
    shards[`${ACTIONS_PREFIX}${metadata.id}`] = actions;
  }

  // Guardar todo el nuevo formato y limpiar el antiguo
  await chrome.storage.local.set({
    [METADATA_KEY]: metadataList,
    ...shards
  });
  await chrome.storage.local.remove(OLD_SESSIONS_KEY);
  console.log("Migración completada con éxito.");
}

/**
 * Obtiene solo el listado de metadatos de las sesiones
 */
export async function getSessionsMetadata() {
  await migrateIfNeeded();
  const result = await chrome.storage.local.get(METADATA_KEY);
  const rawData = result[METADATA_KEY] || [];
  return z.array(SessionMetadataSchema).parse(rawData);
}

/**
 * Obtiene las acciones de una sesión específica (Shard)
 */
export async function getSessionActions(sessionId) {
  const key = `${ACTIONS_PREFIX}${sessionId}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || [];
}

/**
 * Crea una nueva sesión inicializando su shard
 */
export async function createRecordingSession(title, url) {
  const input = CreateSessionInputSchema.parse({ name: title, url });
  const metadataList = await getSessionsMetadata();
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const newMetadata = SessionMetadataSchema.parse({
    id: sessionId,
    title: input.name || `Grabación ${metadataList.length + 1}`,
    url: input.url || null,
    createdDate: new Date().toISOString(),
    status: 'active',
    actionCount: 0
  });

  metadataList.unshift(newMetadata);
  
  await chrome.storage.local.set({ 
    [METADATA_KEY]: metadataList.slice(0, 100), // Límite de 100 sesiones en el índice
    [`${ACTIONS_PREFIX}${sessionId}`]: [] 
  });
  
  return newMetadata;
}

/**
 * Agrega una acción al shard de la sesión y actualiza el contador en metadata
 */
export async function updateSessionActions(sessionId, action) {
  if (!sessionId) return;

  const actionsKey = `${ACTIONS_PREFIX}${sessionId}`;
  const res = await chrome.storage.local.get([actionsKey, METADATA_KEY]);
  
  const actions = res[actionsKey] || [];
  const metadataList = res[METADATA_KEY] || [];

  // 1. Actualizar Shard de Acciones
  const validatedAction = ActionSchema.parse(action);
  actions.push(validatedAction);
  
  // 2. Actualizar Metadata (solo el contador)
  const metaIndex = metadataList.findIndex(m => m.id === sessionId);
  if (metaIndex !== -1) {
    metadataList[metaIndex].actionCount = actions.length;
  }

  await chrome.storage.local.set({ 
    [actionsKey]: actions,
    [METADATA_KEY]: metadataList
  });
}

/**
 * Elimina una sesión y su shard asociado
 */
export async function deleteRecordingSession(sessionId) {
  const metadataList = await getSessionsMetadata();
  const filteredMetadata = metadataList.filter(m => m.id !== sessionId);
  
  await chrome.storage.local.set({ [METADATA_KEY]: filteredMetadata });
  await chrome.storage.local.remove(`${ACTIONS_PREFIX}${sessionId}`);
}

/**
 * Actualiza el título en el índice de metadatos
 */
export async function updateSessionTitle(sessionId, title) {
  const metadataList = await getSessionsMetadata();
  const index = metadataList.findIndex(m => m.id === sessionId);
  if (index !== -1) {
    metadataList[index].title = z.string().min(1).parse(title);
    await chrome.storage.local.set({ [METADATA_KEY]: metadataList });
  }
}
