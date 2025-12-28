# Contributing to Jarvis

First off, thank you for considering contributing to Jarvis! Whether you're fixing a bug, adding a feature, or just tidying up the code, your help makes this project better for everyone.

Jarvis was built on the belief that powerful tools should be open, private, and free. By contributing, you're helping us stay that way.

## How to get started

### 1. Fork and Clone
Fork the repository on GitHub and clone it to your machine:
```bash
git clone https://github.com/YOUR_USERNAME/jarvis-ai-assistant.git
cd jarvis-ai-assistant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Mode
This will start the app with hot-reloading (mostly):
```bash
npm run dev
```

## Development Guide

- **Tech Stack:** Electron, React, TypeScript, and some C++ for native modules (monitors/audio).
- **Architecture:** 
  - `src/main.ts`: Entry point for the main process.
  - `src/components/`: React frontend.
  - `src/services/`: Core logic (command parsing, settings, windows).
  - `src/native/`: C++ code for system-level integrations (hotkeys, power management).
- **Coding Style:** We use TypeScript for everything we can. Try to keep code clean and modular.

## Submitting changes

1. **Create a branch:** `git checkout -b your-feature-name`
2. **Commit your changes:** Be descriptive! Use conventional commits if you can (e.g., `feat: keep it simple`, `fix: corrected typo`).
3. **Push to your fork:** `git push origin your-feature-name`
4. **Open a Pull Request:** Explain what you changed and why. Screenshots/videos are always welcome for UI changes.

## Areas where we need help

Check the [Roadmap](https://github.com/akshayaggarwal99/jarvis-ai-assistant#roadmap-help-me-choose) in the README or the [GitHub Issues](https://github.com/akshayaggarwal99/jarvis-ai-assistant/issues). We especially need help with:
- **Windows Support:** Moving our native Mac monitors over to Windows.
- **New Actions:** Adding more intelligent command parsing for things like reminders, emails, or system control.
- **UI/UX:** Improving the settings layout and general "feel" of the app.

## Questions?
Open an issue or reach out. We're a small community, and we're happy to help you get your first PR merged.

---

**Note on native modules:** If you're touching the monitors or audio capture, you'll need `node-gyp` and Xcode CLI tools installed. Changes to native code require `npm run build:native`.
