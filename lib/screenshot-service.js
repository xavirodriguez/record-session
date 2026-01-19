
const DB_NAME = 'WebJourneyScreenshots';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';
const EXTRACTED_ELEMENTS_STORE = 'extractedElements';

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(EXTRACTED_ELEMENTS_STORE)) {
        const extractedStore = db.createObjectStore(EXTRACTED_ELEMENTS_STORE, { keyPath: 'id' });
        extractedStore.createIndex('screenshotId', 'screenshotId', { unique: false });
      }
    };
  });
}

function dataUrlToBlob(dataUrl) {
  // 🛡️ Sentinel: Validate that the data URL is an image to prevent XSS.
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid data URL: Must be an image.');
  }
  const [header, base64] = dataUrl.split(',');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: header.match(/data:([^;]+)/)?.[1] || 'image/jpeg' });
}

export async function storeScreenshot(dataUrl, url, tabId, sessionId = null) {
  const screenshotId = 'scr_' + Date.now();
  const blob = dataUrlToBlob(dataUrl);
  
  const screenshotData = {
    id: screenshotId,
    timestamp: Date.now(),
    data: blob,
    url,
    tabId,
    sessionId
  };
  
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await new Promise((r, j) => {
    const req = tx.objectStore(STORE_NAME).add(screenshotData);
    req.onsuccess = r; req.onerror = j;
  });
  return screenshotId;
}

export async function getScreenshot(id) {
  const db = await openDatabase();
  const tx = db.transaction([STORE_NAME, EXTRACTED_ELEMENTS_STORE], 'readonly');
  
  let item = await new Promise(r => {
    const req = tx.objectStore(EXTRACTED_ELEMENTS_STORE).get(id);
    req.onsuccess = () => r(req.result);
  });
  
  if (!item) {
    item = await new Promise(r => {
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => r(req.result);
    });
  }
  
  if (item && item.data instanceof Blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(item.data);
    });
  }
  return null;
}

export async function extractElementFromScreenshot(screenshotBlob, boundingBox) {
  try {
    const bitmap = await createImageBitmap(screenshotBlob);
    const canvas = new OffscreenCanvas(boundingBox.width || 100, boundingBox.height || 100);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, boundingBox.left, boundingBox.top, boundingBox.width, boundingBox.height, 0, 0, boundingBox.width, boundingBox.height);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    bitmap.close();
    return blob;
  } catch (e) {
    return screenshotBlob;
  }
}

export async function storeExtractedElement(screenshotId, extractedBlob, boundingBox, elementType, elementInfo, eventId = null) {
  const id = 'el_' + Date.now();
  const db = await openDatabase();
  const tx = db.transaction(EXTRACTED_ELEMENTS_STORE, 'readwrite');
  await new Promise((r, j) => {
    const req = tx.objectStore(EXTRACTED_ELEMENTS_STORE).add({
      id, screenshotId, data: extractedBlob, boundingBox, elementType, elementInfo, eventId, timestamp: Date.now()
    });
    req.onsuccess = r; req.onerror = j;
  });
  return id;
}

export async function getScreenshotStorageInfo() {
  const db = await openDatabase();
  const tx = db.transaction([STORE_NAME, EXTRACTED_ELEMENTS_STORE], 'readonly');
  const allScr = await new Promise(r => {
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => r(req.result);
  });
  const allEl = await new Promise(r => {
    const req = tx.objectStore(EXTRACTED_ELEMENTS_STORE).getAll();
    req.onsuccess = () => r(req.result);
  });
  const totalSize = [...allScr, ...allEl].reduce((acc, s) => acc + (s.data?.size || 0), 0);
  return { count: allScr.length + allEl.length, totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2) };
}

export async function clearAllScreenshots() {
  const db = await openDatabase();
  const tx = db.transaction([STORE_NAME, EXTRACTED_ELEMENTS_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(EXTRACTED_ELEMENTS_STORE).clear();
}
