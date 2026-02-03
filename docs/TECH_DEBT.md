# Deuda Técnica y Backlog

Este documento registra los "gaps" detectados y las mejoras arquitectónicas pendientes.

## 🔴 Prioridad Alta (High Impact)
- **Audio Worklet Migration**: Mover el procesamiento de YIN fuera del main thread para evitar micro-cortos en la UI.
- **IndexedDB for Sessions**: `localStorage` tiene un límite de 5MB que es insuficiente para guardar muchas sesiones con metadatos técnicos.
- **Race Conditions en AudioContext**: Arreglar la inicialización intermitente en Safari iOS.

## 🟡 Prioridad Media (Medium)
- **Unit Test Coverage**: Aumentar la cobertura del módulo de generación de MusicXML al 90%.
- **Sentry Integration**: Implementar el reporte de errores automático.
- **Component Memoization**: Optimizar re-renders en el Tuner Gauge.

## 🟢 Prioridad Baja (Low)
- **Dark Mode CSS Cleanup**: Unificar variables de colores en `styles/variables.css`.
- **Refactor Logger**: Permitir diferentes destinos de log según el entorno.

## 🛠 Convención de Reporte
Usa los siguientes tags en el código para facilitar el seguimiento:
- `TODO`: Tareas pendientes programadas.
- `FIXME`: Bugs conocidos que necesitan una solución definitiva.
- `DEBT`: Código que funciona pero viola principios de arquitectura o rendimiento.

Para reportar una nueva deuda, abre una Issue con el label `tech-debt`.
