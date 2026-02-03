# Guía de Inicio Rápido (Getting Started)

Bienvenido al desarrollo de **Violin Mentor**. Esta guía te ayudará a configurar tu entorno y entender la estructura del proyecto.

## 📋 Prerrequisitos
- **Node.js**: v18.0.0 o superior.
- **pnpm**: Recomendado (o npm v9+).
- **Sistema Operativo**: Windows, macOS o Linux con soporte para Web Audio API.

## ⚙️ Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/your-repo/violin-mentor.git
   cd violin-mentor
   ```

2. Instala las dependencias:
   ```bash
   pnpm install
   ```

3. Configura las variables de entorno:
   ```bash
   cp .env.example .env.local
   ```

## 🚀 Servidor de Desarrollo

Inicia el servidor de desarrollo:
```bash
npm run dev
```
El servidor estará disponible en `http://localhost:3000`.

## 🧪 Tests y Calidad

- **Unitarios/Integración**: `npm run test` (Vitest)
- **E2E**: `npm run test:e2e` (Playwright)
- **Lint**: `npm run lint`
- **Build**: `npm run build`

## 🧠 Estructura Mental del Repo (Onboarding)

El proyecto sigue una **Arquitectura Hexagonal**:

1. **Domain (`lib/domain`)**: Contiene la lógica pura, tipos y reglas de negocio (ej. cálculo de afinación). No depende de nada.
2. **Ports (`lib/ports`)**: Interfaces que definen cómo el dominio se comunica con el exterior (ej. `AudioPort`).
3. **Adapters (`lib/adapters`)**: Implementaciones reales de los ports (ej. `WebAudioAdapter` que usa el micrófono).
4. **UI (`components/`, `hooks/`)**: La capa de presentación que reacciona al estado de los stores.
5. **State (`stores/`)**: Zustand maneja la persistencia y coordinación de eventos.

## 🛠 Troubleshooting Común
- **El micrófono no se activa**: Revisa que la pestaña tenga permisos y que ninguna otra app esté bloqueando el dispositivo.
- **Errores de tipos**: Asegúrate de que `pnpm install` se ejecutó correctamente.
- **OSMD no renderiza**: Verifica que el MusicXML generado sea válido.
