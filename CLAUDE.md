# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Development (hot-reload)
npm run dev

# Build TypeScript + native modules
npm run build

# Build Mac app (unpacked, for testing)
npm run build:mac

# After building, ALWAYS update /Applications with the latest build:
rm -rf "/Applications/Jarvis - AI Assistant.app" && cp -R "release/mac-arm64/Jarvis - AI Assistant.app" /Applications/

# Build signed DMG for distribution
npm run build:signed        # Both architectures
npm run build:signed:arm64  # Apple Silicon only
npm run build:signed:x64    # Intel only

# Rebuild native modules only
npm run build:native

# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

## Architecture Overview

Jarvis is an Electron app for macOS that provides voice dictation with AI-powered text enhancement. The app uses push-to-talk (hold a modifier key to record) and can work fully offline or with cloud services.

### Process Model

- **Main Process** (`src/main.ts`): Orchestrates hotkey monitoring, window management, and coordinates between services. Handles the push-to-talk flow: key down → start recording → key up → transcribe → enhance → paste.
- **Renderer Processes**: React-based UI for dashboard (`src/components/`), waveform overlay (`src/waveform.html`), and onboarding (`src/onboarding/`).
- **Native Modules** (`src/native/*.mm`): Objective-C++ addons for low-level macOS integration.

### Native Modules (requires Xcode CLI tools)

| Module | Purpose |
|--------|---------|
| `universal_key_monitor` | Monitors modifier keys (fn, option, control, command) for push-to-talk |
| `audio_capture` | Real-time microphone capture via AVFoundation |
| `typing_monitor` | Detects user typing to avoid conflicts |
| `fn_key_monitor` | Legacy fn key detection |

Changes to native code require `npm run build:native`.

### Key Services (`src/services/`)

- **WindowManager**: Creates/manages BrowserWindows (dashboard, waveform, suggestion overlay)
- **MenuService**: System tray icon and menu
- **AppSettingsService**: User preferences persistence
- **TranscriptionService**: Routes to appropriate transcriber (Deepgram, OpenAI, local Whisper)

### Input Pipeline (`src/input/`)

The push-to-talk flow is orchestrated by:
1. **UniversalKeyService**: Wraps native key monitor, fires callbacks on key down/up
2. **PushToTalkService**: Facade that delegates to PushToTalkOrchestrator
3. **PushToTalkOrchestrator**: Coordinates audio recording, transcription, and text output
4. **AudioRecordingManager**: Manages audio capture sessions
5. **TranscriptionManager**: Handles transcription (streaming or batch)
6. **TextOutputManager**: Pastes final text to active application

### Transcription (`src/transcription/`)

Multiple backends supported:
- **DeepgramTranscriber** / **DeepgramStreamingTranscriber**: Cloud transcription
- **LocalWhisperTranscriber**: Offline via whisper-node-addon
- **OpenAITranscriber** / **GPT4oTranscriber**: OpenAI Whisper API

### AI/LLM (`src/core/`)

- **CloudLLMService**: Interfaces with Gemini, OpenAI, Anthropic, or Ollama for text enhancement
- **JarvisCore**: Combines transcription context with LLM for intelligent responses
- **AgentManager**: Handles LangGraph-based agent workflows

### IPC Handlers (`src/ipc/`)

Modular IPC handlers for different feature domains. Each handler registers its own `ipcMain.handle()` calls:
- `SettingsIPCHandlers`: Hotkey changes, transcription settings
- `DictationIPCHandlers`: Recording state, mode switching
- `OnboardingIPCHandlers`: First-run wizard flow

## Hotkey Configuration

Supported hotkeys defined in `src/components/Settings.tsx`:
- `fn` - Function key (push-to-talk)
- `cmd+shift+space` - Toggle recording (press to start, press to stop)
- `option`, `control`, `command` - Modifier key push-to-talk

Hotkey handling in `main.ts`:
- Modifier keys use `UniversalKeyService` (native monitoring)
- `cmd+shift+space` uses Electron's `globalShortcut` API

## UI Windows

- **Waveform** (`src/waveform.html`): Small overlay showing recording state, positioned bottom-right of active monitor
- **Dashboard** (`src/dashboard-react.html` + `src/components/`): React app for settings, history, onboarding
- **Analysis Overlay**: Screen analysis features

## Testing

Tests use Jest. Run specific test files:
```bash
npx jest path/to/test.ts
```

## Notes

- The app requires Accessibility and Microphone permissions on macOS
- Settings stored in `~/Library/Application Support/jarvis-ai-assistant/`
- Debug logs available via `Logger` class throughout codebase
