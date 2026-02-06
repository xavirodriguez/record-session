
import { z } from "zod";
import { SessionMetadataSchema, SessionSchema, ActionSchema, CreateSessionInputSchema } from "./domain-schemas.js";
import { openDatabase } from "./screenshot-service.js";

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
 * Obtiene las acciones de una sesión específica desde IndexedDB.
 */
export async function getSessionActions(sessionId) {
  const db = await openDatabase();
  const tx = db.transaction('actions', 'readonly');
  const index = tx.objectStore('actions').index('sessionId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(sessionId));
    request.onsuccess = () => {
      // Ordenar por orderIndex para mantener el orden definido por el usuario o de inserción.
      const actions = request.result.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      resolve(actions);
    };
    request.onerror = () => reject(request.error);
  });
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
    [METADATA_KEY]: metadataList.slice(0, 100) // Límite de 100 sesiones en el índice
  });
  
  return newMetadata;
}

/**
 * Agrega una acción a IndexedDB y actualiza el contador en metadata de chrome.storage.
 */
export async function updateSessionActions(sessionId, action) {
  if (!sessionId) return;

  const res = await chrome.storage.local.get(METADATA_KEY);
  const metadataList = res[METADATA_KEY] || [];
  const metaIndex = metadataList.findIndex(m => m.id === sessionId);
  const currentCount = metaIndex !== -1 ? metadataList[metaIndex].actionCount : 0;

  const db = await openDatabase();
  const tx = db.transaction('actions', 'readwrite');
  // Usamos currentCount como orderIndex inicial para nuevas acciones.
  const validatedAction = ActionSchema.parse({ ...action, sessionId, orderIndex: currentCount });

  await new Promise((resolve, reject) => {
    const request = tx.objectStore('actions').add(validatedAction);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });

  // Actualizar solo el contador en Metadata (chrome.storage)
  if (metaIndex !== -1) {
    metadataList[metaIndex].actionCount += 1;
    await chrome.storage.local.set({ [METADATA_KEY]: metadataList });
  }
}

/**
 * Elimina una sesión y todas sus acciones asociadas en IDB y Metadata.
 */
export async function deleteRecordingSession(sessionId) {
  const metadataList = await getSessionsMetadata();
  const filteredMetadata = metadataList.filter(m => m.id !== sessionId);
  await chrome.storage.local.set({ [METADATA_KEY]: filteredMetadata });

  const db = await openDatabase();
  const tx = db.transaction('actions', 'readwrite');
  const index = tx.objectStore('actions').index('sessionId');

  const cursorRequest = index.openCursor(IDBKeyRange.only(sessionId));
  return new Promise((resolve, reject) => {
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
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

/**
 * Elimina una acción individual de IndexedDB y actualiza el contador.
 */
export async function deleteSessionAction(sessionId, actionId) {
  const db = await openDatabase();
  const tx = db.transaction('actions', 'readwrite');
  await new Promise((r, j) => {
    const req = tx.objectStore('actions').delete(actionId);
    req.onsuccess = r; req.onerror = j;
  });

  // Actualizar contador en metadata
  const actions = await getSessionActions(sessionId);
  const metadataList = await getSessionsMetadata();
  const index = metadataList.findIndex(m => m.id === sessionId);
  if (index !== -1) {
    metadataList[index].actionCount = actions.length;
    await chrome.storage.local.set({ [METADATA_KEY]: metadataList });
  }
}

/**
 * Reordena acciones en IndexedDB actualizando sus orderIndex.
 */
export async function reorderSessionActions(sessionId, actions) {
    const db = await openDatabase();
    const tx = db.transaction('actions', 'readwrite');
    const store = tx.objectStore('actions');

    // Validar el array de acciones entrante
    const validatedActions = z.array(ActionSchema).parse(actions);

    // Actualizamos el orderIndex de cada acción según su posición en el array recibido.
    return new Promise((resolve, reject) => {
        let completed = 0;
        if (validatedActions.length === 0) resolve();

        validatedActions.forEach((action, index) => {
            const updatedAction = { ...action, orderIndex: index };
            const req = store.put(updatedAction);
            req.onsuccess = () => {
                completed++;
                if (completed === validatedActions.length) resolve();
            };
            req.onerror = () => reject(req.error);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function clearAllSessions() {
  // Limpiar metadatos en chrome.storage
  await chrome.storage.local.remove(METADATA_KEY);

  // Limpiar todas las acciones en IndexedDB
  const db = await openDatabase();
  const tx = db.transaction('actions', 'readwrite');
  tx.objectStore('actions').clear();
}
