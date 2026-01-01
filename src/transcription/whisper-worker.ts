/**
 * Whisper Worker Process
 * 
 * This script runs in a child process and keeps the Whisper model loaded in memory.
 * It communicates with the main process via IPC to receive transcription requests.
 */

import * as path from 'path';
import * as fs from 'fs';

// Track loaded state
let isModelLoaded = false;
let currentModelPath: string | null = null;
let transcribeFunction: ((options: any) => Promise<string[][]>) | null = null;

// Message types
interface WorkerMessage {
    type: 'init' | 'transcribe' | 'unload' | 'status';
    id: string;
    payload?: any;
}

interface WorkerResponse {
    type: 'result' | 'error';
    id: string;
    payload?: any;
    error?: string;
}

function sendResponse(response: WorkerResponse) {
    if (process.send) {
        process.send(response);
    }
}

async function initializeModel(modelPath: string): Promise<void> {
    try {
        console.log(`[WhisperWorker] Loading model from: ${modelPath}`);

        if (!fs.existsSync(modelPath)) {
            throw new Error(`Model file not found: ${modelPath}`);
        }

        // Import the transcribe function (this also validates the addon is working)
        const whisperAddon = await import('whisper-node-addon');
        transcribeFunction = whisperAddon.transcribe;

        currentModelPath = modelPath;
        isModelLoaded = true;

        console.log(`[WhisperWorker] Model loaded successfully: ${path.basename(modelPath)}`);
    } catch (error) {
        console.error('[WhisperWorker] Failed to initialize model:', error);
        throw error;
    }
}

async function transcribeAudio(
    audioFilePath: string,
    language: string = 'en'
): Promise<string> {
    if (!isModelLoaded || !transcribeFunction || !currentModelPath) {
        throw new Error('Model not loaded. Call init first.');
    }

    if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    console.log(`[WhisperWorker] Transcribing: ${audioFilePath}`);
    const startTime = Date.now();

    const result = await transcribeFunction({
        model: currentModelPath,
        fname_inp: audioFilePath,
        language: language,
        translate: false,
        no_prints: true,
        no_timestamps: true
    });

    // Parse result - it's a string[][] (array of [timestamp, text] tuples)
    let transcriptText = '';
    if (Array.isArray(result) && result.length > 0) {
        const textParts: string[] = [];
        for (const item of result) {
            if (Array.isArray(item)) {
                const text = item[item.length - 1];
                if (typeof text === 'string' && text.trim()) {
                    textParts.push(text.trim());
                }
            } else if (typeof item === 'string' && item.trim()) {
                textParts.push(item.trim());
            }
        }
        transcriptText = textParts.join(' ').trim();
    } else if (typeof result === 'string') {
        transcriptText = result.trim();
    }

    // Filter out silence tokens
    transcriptText = transcriptText.replace(/(?:\[BLANK_AUDIO\]|\[\s*Silence\s*\]|\(\s*Silence\s*\))/gi, '').trim();

    const duration = Date.now() - startTime;
    console.log(`[WhisperWorker] Transcription complete in ${duration}ms: "${transcriptText.substring(0, 50)}..."`);

    return transcriptText;
}

function unloadModel() {
    isModelLoaded = false;
    currentModelPath = null;
    transcribeFunction = null;
    console.log('[WhisperWorker] Model unloaded');
}

// Handle messages from parent process
process.on('message', async (message: WorkerMessage) => {
    const { type, id, payload } = message;

    try {
        switch (type) {
            case 'init':
                await initializeModel(payload.modelPath);
                sendResponse({ type: 'result', id, payload: { success: true } });
                break;

            case 'transcribe':
                const text = await transcribeAudio(payload.audioFilePath, payload.language);
                sendResponse({ type: 'result', id, payload: { text } });
                break;

            case 'unload':
                unloadModel();
                sendResponse({ type: 'result', id, payload: { success: true } });
                break;

            case 'status':
                sendResponse({
                    type: 'result',
                    id,
                    payload: {
                        isLoaded: isModelLoaded,
                        modelPath: currentModelPath
                    }
                });
                break;

            default:
                sendResponse({ type: 'error', id, error: `Unknown message type: ${type}` });
        }
    } catch (error: any) {
        console.error(`[WhisperWorker] Error handling ${type}:`, error);
        sendResponse({ type: 'error', id, error: error.message || String(error) });
    }
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('[WhisperWorker] Received SIGTERM, shutting down...');
    unloadModel();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[WhisperWorker] Received SIGINT, shutting down...');
    unloadModel();
    process.exit(0);
});

console.log('[WhisperWorker] Worker process started, waiting for messages...');
