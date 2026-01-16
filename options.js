
document.addEventListener('DOMContentLoaded', () => {
  // Cargar valores actuales
  chrome.storage.local.get(['webjourney_config'], (res) => {
    const config = res.webjourney_config || {};
    // Fix: Removed apiKey handling as it must not be managed by user per guidelines
    if (config.quality) document.getElementById('quality').value = config.quality;
    if (config.autoOpen) document.getElementById('autoOpen').checked = config.autoOpen;
  });

  // Guardar valores
  document.getElementById('save').addEventListener('click', () => {
    // Fix: Removed apiKey handling as it must be obtained exclusively from process.env.API_KEY
    const quality = document.getElementById('quality').value;
    const autoOpen = document.getElementById('autoOpen').checked;

    chrome.storage.local.set({
      webjourney_config: { quality, autoOpen }
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
