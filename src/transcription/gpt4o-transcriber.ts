import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Logger } from '../core/logger';
import { SecureAPIService } from '../services/secure-api-service';

export interface GPT4oTranscribeResult {
  text: string | null;
}

// Unused helper functions removed - functionality consolidated elsewhere

async function transcribeWithGPT4oMini(audioFilePath: string, dictionaryContext?: string): Promise<string | null> {
  try {
    const secureAPI = SecureAPIService.getInstance();
    const openaiKey = await secureAPI.getOpenAIKey();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'gpt-4o-mini-transcribe');
    formData.append('response_format', 'text');
    
    // Add dictionary keywords as prompt if available (for word recognition hints)
    if (dictionaryContext) {
      // Format as recognition hints rather than instructions to avoid prompt leakage
      const promptHint = `This audio may contain these terms: ${dictionaryContext}`;
      formData.append('prompt', promptHint);
      Logger.info(`📖 [gpt-4o-mini] Using keyword hints: ${dictionaryContext.substring(0, 50)}...`);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) throw new Error(`gpt-4o-mini-transcribe failed: ${response.status}`);
    
    const text = await response.text();
    return text?.trim() || null;
  } catch (error) {
    Logger.warning('gpt-4o-mini-transcribe failed:', String(error));
    return null;
  }
}

async function transcribeWithGPT4oTranscribe(audioFilePath: string, dictionaryContext?: string): Promise<string | null> {
  try {
    const secureAPI = SecureAPIService.getInstance();
    const openaiKey = await secureAPI.getOpenAIKey();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'gpt-4o-transcribe');
    formData.append('response_format', 'text');
    
    // Add dictionary keywords as prompt if available (for word recognition hints)
    if (dictionaryContext) {
      // Format as recognition hints rather than instructions to avoid prompt leakage
      const promptHint = `This audio may contain these terms: ${dictionaryContext}`;
      formData.append('prompt', promptHint);
      Logger.info(`📖 [gpt-4o-transcribe] Using keyword hints: ${dictionaryContext.substring(0, 50)}...`);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) throw new Error(`gpt-4o-transcribe failed: ${response.status}`);
    
    const text = await response.text();
    return text?.trim() || null;
  } catch (error) {
    Logger.warning('gpt-4o-transcribe failed:', String(error));
    return null;
  }
}

async function transcribeWithWhisper1(audioFilePath: string, dictionaryContext?: string): Promise<string | null> {
  try {
    const secureAPI = SecureAPIService.getInstance();
    const openaiKey = await secureAPI.getOpenAIKey();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('language', 'en');  // Force English language
    
    // Add dictionary keywords as prompt if available (for word recognition hints)
    if (dictionaryContext) {
      // Format as recognition hints rather than instructions to avoid prompt leakage
      const promptHint = `This audio may contain these terms: ${dictionaryContext}`;
      formData.append('prompt', promptHint);
      Logger.info(`📖 [whisper-1] Using keyword hints: ${dictionaryContext.substring(0, 50)}...`);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) throw new Error(`whisper-1 failed: ${response.status}`);
    
    const text = await response.text();
    return text?.trim() || null;
  } catch (error) {
    Logger.warning('whisper-1 failed:', String(error));
    return null;
  }
}

// Gemini transcription functions removed - not currently used

export async function transcribeWithBestModel(audioFilePath: string): Promise<GPT4oTranscribeResult> {
  Logger.info('🎯 Starting dictation transcription with proper fallback chain');
  Logger.info('� [Fallback] gpt-4o-mini-transcribe → gpt-4o-transcribe → whisper-1 → gemini-2.5-flash-lite → whisper local');

  // Get dictionary context for enhanced prompts
  const { nodeDictionaryService } = await import('../services/node-dictionary');
  const dictionaryContext = nodeDictionaryService.getWordsForTranscription();

  // Step 1: Try gpt-4o-mini-transcribe
  Logger.info('🚀 [Step 1] Trying gpt-4o-mini-transcribe...');
  let result = await transcribeWithGPT4oMini(audioFilePath, dictionaryContext);
  if (result) {
    Logger.info('✅ [Step 1] Success with gpt-4o-mini-transcribe');
    return { text: result };
  }

  // Step 2: Try gpt-4o-transcribe
  Logger.info('� [Step 2] Trying gpt-4o-transcribe...');
  result = await transcribeWithGPT4oTranscribe(audioFilePath, dictionaryContext);
  if (result) {
    Logger.info('✅ [Step 2] Success with gpt-4o-transcribe');
    return { text: result };
  }

  // Step 3: Try whisper-1
  Logger.info('🚀 [Step 3] Trying whisper-1...');
  result = await transcribeWithWhisper1(audioFilePath, dictionaryContext);
  if (result) {
    Logger.info('✅ [Step 3] Success with whisper-1');
    return { text: result };
  }

  Logger.error('❌ All transcription models failed');
  return { text: null };
}

// Unused prompt-based transcription functions removed