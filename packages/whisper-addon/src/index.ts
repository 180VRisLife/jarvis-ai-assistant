/**
 * TypeScript wrapper for whisper.cpp native addon
 * 
 * Provides persistent model caching - model is loaded once and kept in memory
 * for fast subsequent transcriptions.
 * 
 * Usage:
 *   const whisper = new WhisperCpp('/path/to/model.bin');
 *   await whisper.load();
 *   const text = await whisper.transcribe(audioFloat32Array);
 *   await whisper.free();
 */

import * as path from 'path';

// Load native addon
const addonPath = path.join(__dirname, '..', 'native', 'whisper_addon.node');
let binding: any;

try {
    binding = require(addonPath);
} catch (error) {
    console.error(`[WhisperAddon] Failed to load native binding from ${addonPath}:`, error);
    throw new Error('Failed to load whisper native addon');
}

export interface TranscribeResult {
    text: string;
    segments: Array<{
        text: string;
        from: number;
        to: number;
    }>;
}

export interface WhisperOptions {
    gpu?: boolean;
}

export interface TranscribeOptions {
    language?: string;
    prompt?: string;
}

export class WhisperCpp {
    private handle: any = null;
    private modelPath: string;
    private options: WhisperOptions;

    constructor(modelPath: string, options: WhisperOptions = {}) {
        this.modelPath = modelPath;
        this.options = options;
    }

    /**
     * Check if model is loaded
     */
    isLoaded(): boolean {
        return this.handle !== null;
    }

    /**
     * Load the model into memory
     * Call this once on startup for fast subsequent transcriptions
     */
    async load(): Promise<void> {
        if (this.handle) {
            return; // Already loaded
        }

        console.log(`[WhisperAddon] Loading model: ${this.modelPath}`);
        const startTime = Date.now();

        this.handle = binding.init({
            model: this.modelPath,
            gpu: this.options.gpu !== false // Default to GPU if available
        });

        const duration = Date.now() - startTime;
        console.log(`[WhisperAddon] Model loaded in ${duration}ms`);
    }

    /**
     * Transcribe audio using the pre-loaded model
     * 
     * @param audio Float32Array of audio samples (16kHz, mono)
     * @param options Transcription options
     * @returns Transcription result with text and segments
     */
    async transcribe(
        audio: Float32Array,
        options: TranscribeOptions = {}
    ): Promise<TranscribeResult> {
        if (!this.handle) {
            throw new Error('Model not loaded. Call load() first.');
        }

        const startTime = Date.now();

        const result = binding.transcribe(this.handle, {
            audio,
            language: options.language || 'en',
            prompt: options.prompt
        });

        const duration = Date.now() - startTime;
        console.log(`[WhisperAddon] Transcription complete in ${duration}ms: "${result.text.substring(0, 50)}..."`);

        return result;
    }

    /**
     * Free the model from memory
     */
    async free(): Promise<void> {
        if (this.handle) {
            binding.free(this.handle);
            this.handle = null;
            console.log('[WhisperAddon] Model freed');
        }
    }

    /**
     * Get model info
     */
    getInfo(): { loaded: boolean; model: string } | null {
        if (!this.handle) {
            return null;
        }
        return binding.getInfo(this.handle);
    }
}

// Export binding for advanced usage
export { binding };
