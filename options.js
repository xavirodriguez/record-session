
document.addEventListener('DOMContentLoaded', () => {
  // Cargar valores actuales a través del service worker
  chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
    if (config) {
      if (config.quality) document.getElementById('quality').value = config.quality;
      if (config.autoOpen) document.getElementById('autoOpen').checked = config.autoOpen;
    }
  });

  // Guardar valores a través del service worker
  document.getElementById('save').addEventListener('click', () => {
    const quality = document.getElementById('quality').value;
    const autoOpen = document.getElementById('autoOpen').checked;

    const newConfig = { quality, autoOpen };

    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig }, (response) => {
      if (response.success) {
        const btn = document.getElementById('save');
        btn.textContent = '¡Guardado!';
        btn.classList.replace('bg-indigo-600', 'bg-green-600');
        setTimeout(() => {
          btn.textContent = 'Guardar Configuración';
          btn.classList.replace('bg-green-600', 'bg-indigo-600');
        }, 2000);
      }
    });
  });
});
