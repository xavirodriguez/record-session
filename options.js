
document.addEventListener('DOMContentLoaded', () => {
  const qualityEl = document.getElementById('quality');
  const autoOpenEl = document.getElementById('autoOpen');
  const saveButton = document.getElementById('save');

  // Cargar configuración desde el service worker
  chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
    if (config) {
      if (config.quality) qualityEl.value = config.quality;
      if (config.autoOpen) autoOpenEl.checked = config.autoOpen;
    }
  });

  // Guardar configuración a través del service worker
  saveButton.addEventListener('click', () => {
    const config = {
      quality: qualityEl.value,
      autoOpen: autoOpenEl.checked,
    };

    chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', payload: config }, (response) => {
      if (response.success) {
        saveButton.textContent = '¡Guardado!';
        saveButton.classList.replace('bg-indigo-600', 'bg-green-600');
        setTimeout(() => {
          saveButton.textContent = 'Guardar Configuración';
          saveButton.classList.replace('bg-green-600', 'bg-indigo-600');
        }, 2000);
      }
    });
  });
});
