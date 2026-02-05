# Web Journey Recorder Pro 🚀

A professional-grade Chrome Extension (Manifest V3) for recording technical user journeys with real-time network auditing and UI interaction tracking.

## 📋 Features

- **Real-time Interaction Recording**: Captures clicks, inputs, and form submissions.
- **Full-Stack Network Auditing**: Intercepts and logs `fetch` and `XHR` requests with method and URL details.
- **Smart Screenshots**: Automatically takes visible tab captures and extracts the specific element being interacted with.
- **Sharded Storage Architecture**: Optimized IndexedDB and `chrome.storage.local` usage for high-performance data persistence.
- **Secure & Compliant**: Implements strict CSP, user-gesture permission requests, and robust input sanitization.
- **Developer Friendly**: Built with React 19, TypeScript, Tailwind CSS, and Lucide icons.

## 🛠️ Technical Architecture

- **Service Worker**: Acts as the central orchestrator, managing session state, serialization of actions via promise chains, and secure storage operations.
- **Content Scripts**: Injected into web pages to monitor the DOM for interactions and monkey-patch network APIs for transparent auditing.
- **React UI**: A high-performance dashboard for managing recordings, viewing history, and analyzing session details.
- **Storage Sharding**: Sessions are indexed in a metadata list, while actions are stored in separate shards to ensure O(1) or O(log N) performance during common operations.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Installation & Build

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory.

## 🛡️ Security & Performance (Sentinel & Bolt)

- **Sanitization**: All recorded text content is sanitized via robust regex to prevent XSS.
- **Privacy**: Passwords and sensitive fields are masked, and only `http/https` network requests are logged.
- **Optimization**: Uses `OffscreenCanvas` for image processing and batch messaging to minimize IPC overhead.

---
*Built with precision for the modern web auditor.*
