import { Logger } from '../core/logger';
import { AppSettingsService } from '../services/app-settings-service';
import { 
  defaultDictationPrompt, 
  defaultEmailFormattingPrompt, 
  defaultAssistantPrompt,
  codeAssistantPrompt,
  safetyPrompt
} from './prompts';

export const getDictationPrompt = () => {
  try {
    const settings = AppSettingsService.getInstance().getSettings();
    return settings.customDictationPrompt || defaultDictationPrompt;
  } catch (error) {
    return defaultDictationPrompt;
  }
};

export const getEmailFormattingPrompt = () => {
  try {
    const settings = AppSettingsService.getInstance().getSettings();
    return settings.customEmailPrompt || defaultEmailFormattingPrompt;
  } catch (error) {
    return defaultEmailFormattingPrompt;
  }
};

export const getAssistantPrompt = () => {
  try {
    const settings = AppSettingsService.getInstance().getSettings();
    return settings.customAssistantPrompt || defaultAssistantPrompt;
  } catch (error) {
    return defaultAssistantPrompt;
  }
};

export const createDictationPrompt = () => {
  return getDictationPrompt();
};

export const createAssistantPrompt = (transcript: string, context?: { 
  type?: string; 
  task?: string; 
  hasSelectedText?: boolean; 
  appContext?: string 
}) => {
  const text = transcript.toLowerCase().trim();
  
  // 1. Safety check
  if (containsInappropriateContent(text)) {
    return safetyPrompt;
  }

  // 2. Explicit Jarvis commands (highest priority)
  const isJarvisCommand = /^(hey|hi|hello|okay)?\s*jarvis/.test(text);
  if (isJarvisCommand) {
    Logger.debug('Explicit Jarvis command detected');
    return context?.appContext === 'code' ? codeAssistantPrompt : getAssistantPrompt();
  }

  // 3. Text editing with selected text
  const isTextEditing = context?.hasSelectedText && 
    /\b(make|fix|change|improve|rewrite|professional|formal|casual|grammar|spelling)\b/.test(text);
  if (isTextEditing) {
    Logger.debug('Text editing command with selection detected');
    return getAssistantPrompt();
  }

  // 4. System/CLI commands
  if (isSystemCommand(text)) {
    Logger.debug('System command detected');
    return getAssistantPrompt();
  }

  // 5. Default: Always dictation mode
  Logger.debug('Using dictation mode');
  return getDictationPrompt();
};

function isSystemCommand(text: string): boolean {
  const systemKeywords = [
    'list files', 'show files', 'open', 'launch', 'search for',
    'folder', 'directory', 'file content', 'system info'
  ];
  return systemKeywords.some(keyword => text.includes(keyword));
}

function containsInappropriateContent(text: string): boolean {
  const riskyPatterns = [
    /\b(illegal|harmful|violent)\s+(content|material)/,
    /\b(hack|crack|break)\s+(into|system|password)/,
    /\b(generate|create)\s+(virus|malware)/
  ];
  
  const legitimateExceptions = [
    /\b(life|growth|productivity)\s+hack/,
    /hack\s+(together|up|around)/,
    /hackathon/
  ];
  
  const hasRiskyContent = riskyPatterns.some(pattern => pattern.test(text));
  const hasLegitimateUse = legitimateExceptions.some(pattern => pattern.test(text));
  
  return hasRiskyContent && !hasLegitimateUse;
}
