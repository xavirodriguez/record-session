# Web Journey Recorder Pro

Web Journey Recorder Pro is a powerful Chrome extension for developers, quality assurance engineers, and UX researchers. It allows you to record user journeys through a web application, capturing not only user interactions like clicks and form submissions but also network traffic and screenshots.

## Features

- **User Action Recording:** Automatically captures clicks, form submissions, and input changes.
- **Network Traffic Auditing:** Logs all `fetch` and `XMLHttpRequest` requests made during a recording session.
- **Screenshot Capture:** Takes screenshots of the visible tab at the time of an action.
- **Session Management:** Save, load, and manage multiple recording sessions.
- **Developer-Focused:** Provides detailed technical information about each recorded event.

## Installation

1. Clone this repository to your local machine.
2. Make sure you have Node.js and npm installed.
3. Install the project dependencies by running `npm install` in the project's root directory.
4. Build the extension by running `npm run build`. This will create a `dist` directory with the bundled extension files.
5. Open Chrome and navigate to `chrome://extensions`.
6. Enable "Developer mode" in the top right corner.
7. Click on "Load unpacked" and select the `dist` directory that was created in step 4.

## How to Use

1. Click on the extension icon in the Chrome toolbar to open the popup.
2. Click the "Start Recording" button to begin a new session.
3. Navigate through the web application you want to test, performing the actions you want to record.
4. The extension will capture your interactions and network requests in the background.
5. When you're finished, click the "Stop Recording" button.
6. The recorded session will be saved, and you can review the captured data in the extension's UI.
