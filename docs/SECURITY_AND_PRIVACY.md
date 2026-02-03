# Seguridad y Privacidad

En Violin Mentor, la seguridad del código y la privacidad de los datos del usuario son prioridades fundamentales.

## 🛡️ Validación de Datos con Zod
Todas las entradas de datos externas (API, localStorage, formularios) se validan mediante esquemas de **Zod**.
- **Validated Persistence**: Antes de guardar o cargar del `localStorage`, el estado pasa por un esquema que garantiza la integridad de los tipos.

## 🏷️ Branded Types (Tipado Estricto)
Para evitar errores de dominio (ej. confundir un `NoteId` con un `SessionId`), usamos **Branded Types**:
```typescript
type NoteId = string & { readonly __brand: 'NoteId' };
```
Esto asegura que solo funciones que esperan un `NoteId` puedan recibirlo, mejorando la robustez del código.

## 🎤 Permisos del Navegador
- **Micrófono**: Solo se solicita en el momento exacto en que el usuario inicia una sesión de práctica.
- **Contexto Seguro**: La Web Audio API requiere HTTPS en producción.

## 📉 Política de Datos y Privacidad
- **Local-First**: Por defecto, todas las grabaciones y análisis se guardan exclusivamente en el `localStorage` / `IndexedDB` del navegador del usuario. No se suben audios a ningún servidor.
- **Retention**: El usuario puede configurar el límite de almacenamiento (ej. borrar sesiones de más de 30 días).

## 📊 Telemetría y Opt-Out
Usamos **Vercel Analytics** para medir el rendimiento técnico (latencia, errores de carga de OSMD).
- **Qué trackeamos**: Tiempo de carga, fallos de permisos de micro, errores de renderizado. No trackeamos audios ni contenido musical.
- **Cómo desactivar**: En el menú de Configuración -> Privacidad -> Desactivar Telemetría.

## ❌ Mapeo de Códigos de Error
Usamos un sistema centralizado de errores para facilitar el soporte:
| Código | Descripción | Acción recomendada |
|--------|-------------|--------------------|
| `AUDIO_001` | Micrófono bloqueado | Mostrar guía de permisos del navegador. |
| `OSMD_002` | Error de parsing MusicXML | Validar el archivo fuente. |
| `SEC_003` | Fallo de validación de esquema | Limpiar caché de localStorage (Migration fail). |

## 🔒 Content Security Policy (CSP)
Nuestra política prohíbe el uso de `eval()` y restringe los scripts a `'self'`, excepto para las analíticas permitidas.
