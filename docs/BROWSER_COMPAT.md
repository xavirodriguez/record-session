# Matriz de Compatibilidad de Navegadores

Violin Mentor depende de APIs modernas de audio y visualización.

| Característica | Chrome | Firefox | Safari (macOS) | Safari (iOS) | Edge |
|----------------|--------|---------|----------------|--------------|------|
| Web Audio API | ✅ | ✅ | ✅ | ✅ (14.5+) | ✅ |
| getUserMedia | ✅ | ✅ | ✅ | ✅ | ✅ |
| OSMD Rendering | ✅ | ✅ | ✅ | ✅ | ✅ |
| SharedArrayBuffer| ✅ | ⚠️* | ⚠️* | ⚠️* | ✅ |

*\* Requiere cabeceras de aislamiento Cross-Origin.*

## 🍎 Safari & iOS Caveats
- **AudioContext Resume**: El contexto debe iniciarse tras una interacción del usuario (click/touch).
- **Latency**: En iOS, el uso de dispositivos Bluetooth (ej. AirPods) introduce una latencia significativa que puede afectar al Tuner. Recomendamos auriculares con cable.
- **Sample Rate**: Safari a veces fuerza 48kHz; el motor de YIN maneja esta conversión automáticamente.

## 🛠 Fallbacks
1. **Sin Micrófono**: La app entra en modo "Viewer Only" permitiendo ver partituras pero no practicar.
2. **Navegador Antiguo**: Mostramos un banner de advertencia sugiriendo la actualización a una versión compatible con ES2022.
3. **Poca Memoria**: OSMD desactiva el renderizado de alta calidad si detecta menos de 4GB de RAM disponible.
