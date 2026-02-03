# Pipeline de Audio y Web Audio API

El corazón de Violin Mentor es su motor de procesamiento de audio en tiempo real.

## 🔄 Ciclo de Vida del WebAudio
1. **Initial State**: El `AudioContext` está en estado `suspended` hasta que el usuario interactúa.
2. **Start**: Al iniciar una práctica, se solicita el permiso de micrófono vía `navigator.mediaDevices.getUserMedia`.
3. **Running**: El `AnalyserNode` extrae datos del stream y los pasa al detector de pitch.
4. **Suspended/Closed**: Al finalizar, liberamos los recursos del stream y cerramos el contexto para ahorrar batería y memoria.

## 🛠 AudioManager y Adaptadores
El `AudioManager` es la clase central que coordina los nodos:
- **Source**: Micrófono del usuario.
- **Processing**: `AnalyserNode` con un FFT size de 2048 o 4096 para mayor resolución en frecuencias bajas (G3 del violín).
- **Output**: Generalmente silenciado (`destination` no conectado o `gainNode` en 0) para evitar feedback.

## 🔐 Permisos y Seguridad
- El acceso al micrófono solo está permitido en contextos seguros (HTTPS o localhost).
- El sistema maneja explícitamente el rechazo del permiso mostrando una UI de error amigable.

## ⚡ Latencia y Rendimiento
- **Buffer Size**: Usamos tamaños de buffer pequeños para reducir el delay entre la nota tocada y el feedback visual.
- **Performance Telemetry**: Medimos el tiempo que tarda cada frame de procesamiento. Si excede los 16ms (60fps), se registra como un "Long Task".

## 🚀 Plan para Web Workers
Actualmente el procesamiento ocurre en el main thread. El plan de migración incluye:
1. Usar **Audio Worklet** para el procesamiento pesado.
2. Pasar los buffers de audio vía `SharedArrayBuffer` (si el aislamiento de origen lo permite) o `MessagePort`.

## 🔍 Debugging de Audio
1. Abre las devtools de Chrome.
2. Ve a la pestaña "Web Audio".
3. Observa el grafo de nodos y el estado del contexto.
4. En la consola, puedes acceder al `AudioManager` global si `NEXT_PUBLIC_DEBUG=true`.
