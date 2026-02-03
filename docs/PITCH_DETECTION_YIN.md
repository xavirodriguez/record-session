# Pitch Detection: Algoritmo YIN

Violin Mentor utiliza una implementación del algoritmo **YIN** en TypeScript puro para la detección de frecuencia fundamental.

## 🧐 ¿Por qué YIN?
A diferencia de la Transformada Rápida de Fourier (FFT) simple, YIN es mucho más preciso para detectar el pitch de instrumentos melódicos como el violín, ya que utiliza una función de diferencia cuadrática promedio acumulada para encontrar el periodo de la señal.

## 🎻 Rangos del Violín
El sistema está optimizado para las frecuencias estándar del violín:
- **G3 (Sol)**: ~196 Hz
- **D4 (Re)**: ~293.7 Hz
- **A4 (La)**: 440 Hz
- **E5 (Mi)**: ~659.3 Hz
- Soporta hasta el registro sobre-agudo (~3000 Hz).

## ⚙️ Parámetros de Configuración
- **Threshold**: 0.10 - 0.15. Controla la tolerancia a errores de octava.
- **Probability**: Solo aceptamos detecciones con una probabilidad > 0.85 para evitar "saltos" por ruido de fondo.
- **Sample Rate**: Preferiblemente 44100 Hz.

## 🧪 Tuning y Calibración
- El sistema permite ajustar el **La de referencia** (A4), por defecto en 440 Hz.
- Se aplica un filtro de media móvil (moving average) para suavizar la detección de vibrato sin perder respuesta inmediata.

## 🚫 Manejo de Ruido y Falsos Positivos
- **Noise Gate**: Si la amplitud de la señal es inferior a -50dB, el detector se ignora.
- **Harmonic Filter**: Filtramos armónicos superiores que podrían confundir al algoritmo en cuerdas metálicas.

## 🛠 Pruebas
Puedes probar la precisión del algoritmo usando el script:
```bash
pnpm test:pitch
```
Este script pasa ondas senoidales puras y grabaciones reales de violín por el motor de detección y verifica que el error sea menor a 5 cents.
