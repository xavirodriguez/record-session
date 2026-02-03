# Observabilidad y Logging

Para garantizar que Violin Mentor funcione correctamente en todos los entornos, implementamos una estrategia de observabilidad robusta.

## 🪵 Sistema de Logging
Usamos un logger personalizado que añade contexto automáticamente:

### Niveles de Log
- `DEBUG`: Información técnica detallada (solo en desarrollo).
- `INFO`: Cambios de estado importantes (ej. inicio de sesión).
- `WARN`: Problemas recuperables (ej. latencia alta).
- `ERROR`: Fallos críticos (ej. fallo de AudioContext).

### Uso Recomendado
```typescript
import { logger } from 'lib/observability';

logger.info('Sesión iniciada', { sessionId: 'session_123', mode: 'practice' });
```

## 📊 Telemetría de Rendimiento
Monitorizamos métricas clave para la experiencia del usuario:
- **Audio Processing Latency**: El tiempo que tarda el pipeline en procesar un buffer.
- **OSMD Render Time**: Tiempo de renderizado de la partitura.
- **Interaction to Feedback**: Tiempo desde que se toca una nota hasta que se muestra el highlight.

## 🛰️ Integraciones Futuras (Patrones)
Aunque actualmente somos local-first, la arquitectura está preparada para:
- **Sentry**: Para captura de errores en tiempo real y stack traces.
- **Datadog / LogRocket**: Para reconstrucción de sesiones de usuario con problemas técnicos.

## 🛠 Estrategia Dev vs Prod
- **Dev**: Logs completos en consola, sourcemaps activos.
- **Prod**: Logs filtrados (solo WARN/ERROR), telemetría anonimizada y agregada (sampling al 10%).

## 🔬 Herramientas de Inspección
- **window.__VM_DIAGNOSTICS__**: Un objeto global disponible en desarrollo que devuelve el estado actual de todos los sensores y latencias.
