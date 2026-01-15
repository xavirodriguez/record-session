
document.addEventListener('DOMContentLoaded', () => {
  // Cargar valores actuales
  chrome.storage.local.get(['webjourney_config'], (res) => {
    const config = res.webjourney_config || {};
    if (config.apiKey) document.getElementById('apiKey').value = config.apiKey;
    if (config.quality) document.getElementById('quality').value = config.quality;
    if (config.autoOpen) document.getElementById('autoOpen').checked = config.autoOpen;
  });

  // Guardar valores
  document.getElementById('save').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const quality = document.getElementById('quality').value;
    const autoOpen = document.getElementById('autoOpen').checked;

    chrome.storage.local.set({
      webjourney_config: { apiKey, quality, autoOpen }
    }, () => {
      const btn = document.getElementById('save');
      btn.textContent = '¡Guardado!';
      btn.classList.replace('bg-indigo-600', 'bg-green-600');
      setTimeout(() => {
        btn.textContent = 'Guardar Configuración';
        btn.classList.replace('bg-green-600', 'bg-indigo-600');
      }, 2000);
    });
  });
});
