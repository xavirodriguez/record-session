# Estrategia de Testing

Mantenemos la calidad del software mediante una pirámide de tests automatizados.

## 🧪 Niveles de Test

### 1. Tests Unitarios (Vitest)
- **Foco**: Lógica de dominio, algoritmos matemáticos y utilidades puras.
- **Ejemplo**: Validar que el algoritmo YIN detecta correctamente la frecuencia 440 Hz en un buffer sintético.
- **Ubicación**: `__tests__/unit` o archivos `.test.ts` junto al código fuente.

### 2. Tests de Integración (Vitest + Testing Library)
- **Foco**: Coordinación entre stores, hooks y componentes de React.
- **Patrón**: Mocking de ports. Usamos un `FakeAudioAdapter` en lugar del micrófono real para simular la entrada de notas.

### 3. Tests E2E (Playwright)
- **Foco**: Flujos críticos del usuario de principio a fin.
- **Ejemplo**: "El usuario abre la app, carga una partitura, toca una escala y ve los resultados".
- **Nota**: Usamos archivos de audio pre-grabados para alimentar el `getUserMedia` mediante flags de Chrome en el setup de Playwright.

## 🎼 Testeando Pipelines Async
Para el `PracticeEngine`, usamos **Fake Timers** y generadores de eventos controlados para verificar que:
- Las notas se segmentan correctamente.
- El `AbortSignal` detiene todos los procesos.
- El backpressure funciona bajo carga.

## 🛠 Convenciones
- **Naming**: `[nombre].test.ts` para unitarios, `[nombre].spec.ts` para integración/e2e.
- **Fixtures**: Ubicadas en `__tests__/fixtures` (ej. archivos MusicXML de prueba).
- **Mocks**: Evitamos el mocking excesivo; preferimos usar implementaciones "Fake" de los puertos que mantengan el contrato.

## 🚀 Ejecución
```bash
npm run test          # Todos los tests unitarios
npm run test:ui       # Vitest en modo UI
npm run test:e2e      # Tests de Playwright
```
