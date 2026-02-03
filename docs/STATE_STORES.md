# Gestión de Estado: Zustand y Persistencia

Violin Mentor utiliza **Zustand** para la gestión de estado global, aprovechando su simplicidad y excelente rendimiento con React.

## 🏗️ Patrones de Stores

### 1. Store de Sesión (`useSessionStore`)
Gestiona el estado de la práctica actual.
- **Acciones**: `startSession`, `stopSession`, `updatePitch`, `completeNote`.
- **Selectores**: Usa selectores específicos para evitar re-renders innecesarios (ej. `useSessionStore(state => state.currentNote)`).

### 2. Store de Configuración (`useConfigStore`)
Persiste las preferencias del usuario.
- **Campos**: `a4Frequency`, `metronomeVolume`, `theme`.
- **Persistencia**: Usa el middleware `persist` sincronizado con `localStorage`.

## 💾 Persistencia y Migraciones
Implementamos un sistema de persistencia validado y versionado:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useConfigStore = create(
  persist(
    (set) => ({ ... }),
    {
      name: 'violin-mentor-config',
      version: 1, // Versionado para migraciones
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Lógica de migración de v0 a v1
        }
        return persistedState;
      },
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

## ⚡ Rendimiento y Selectors
Para mantener los 60fps durante el procesamiento de audio:
- **Shallow Equality**: Usa `shallow` de zustand cuando el selector devuelva un objeto.
- **Atomic Updates**: El `PracticeEngine` actualiza solo los campos estrictamente necesarios.

## 🤝 Coordinación entre Stores
Cuando una acción afecta a múltiples dominios, la coordinación se realiza en la capa de hooks o mediante la suscripción manual entre stores en el archivo de inicialización:
```typescript
useSessionStore.subscribe(
  (state) => state.isRecording,
  (isRecording) => {
    if (isRecording) useConfigStore.getState().disableAutoSleep();
  }
);
```

## 🛠 Debugging
Instala la extensión **Redux DevTools** en Chrome; todos los stores de Zustand están conectados para permitir el "Time Travel Debugging" en desarrollo.
