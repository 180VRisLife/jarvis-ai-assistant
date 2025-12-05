import React, { useState, useEffect } from 'react';
import { theme } from '../styles/theme';

interface ApiKeySetupScreenProps {
  onNext: () => void;
  onApiKeysChange?: (hasKeys: boolean) => void;
}

const ApiKeySetupScreen: React.FC<ApiKeySetupScreenProps> = ({ onNext, onApiKeysChange }) => {
  const [deepgramKey, setDeepgramKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasExistingKeys, setHasExistingKeys] = useState(false);
  const [useLocalWhisper, setUseLocalWhisper] = useState(false);

  // Load existing keys and settings on mount
  useEffect(() => {
    const loadKeysAndSettings = async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        
        // Load API keys
        if (electronAPI?.getApiKeys) {
          const keys = await electronAPI.getApiKeys();
          if (keys) {
            if (keys.deepgramApiKey) {
              setDeepgramKey(keys.deepgramApiKey);
              setHasExistingKeys(true);
            }
            if (keys.geminiApiKey) {
              setGeminiKey(keys.geminiApiKey);
              setHasExistingKeys(true);
            }
          }
        }
        
        // Load app settings to check if local whisper is enabled
        if (electronAPI?.appGetSettings) {
          const settings = await electronAPI.appGetSettings();
          if (settings?.useLocalWhisper) {
            setUseLocalWhisper(true);
          }
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };
    loadKeysAndSettings();
  }, []);

  // Notify parent when ready to continue
  useEffect(() => {
    // User can continue if they have Gemini key (required for AI) 
    // OR if they just want to try local-only mode
    const canContinue = geminiKey.trim().length > 0 || useLocalWhisper;
    onApiKeysChange?.(canContinue);
  }, [geminiKey, useLocalWhisper, onApiKeysChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.saveApiKeys) {
        await electronAPI.saveApiKeys({
          deepgramApiKey: deepgramKey.trim(),
          geminiApiKey: geminiKey.trim(),
        });
      }
      if (electronAPI?.appUpdateSettings) {
        await electronAPI.appUpdateSettings({ useLocalWhisper });
      }
      setSaved(true);
      setHasExistingKeys(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save API keys:', error);
    } finally {
      setSaving(false);
    }
  };

  const openExternalLink = (url: string) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExternal) {
      electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const toggleLocalWhisper = async () => {
    const newValue = !useLocalWhisper;
    setUseLocalWhisper(newValue);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.appUpdateSettings) {
        await electronAPI.appUpdateSettings({ useLocalWhisper: newValue });
      }
    } catch (error) {
      console.error('Failed to toggle local whisper:', error);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className={`w-14 h-14 ${theme.glass.primary} ${theme.radius.xl} flex items-center justify-center mx-auto mb-6 ${theme.shadow}`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className={`text-2xl font-semibold ${theme.text.primary} mb-3`}>Quick Setup</h1>
        <p className={`text-sm ${theme.text.secondary} max-w-md mx-auto font-normal leading-relaxed`}>
          Get started in 30 seconds with free API keys
        </p>
      </div>

      {/* Recommended Setup Box */}
      <div className={`${theme.glass.primary} ${theme.radius.xl} p-5 ${theme.shadow} mb-4 border border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${theme.text.primary} mb-1`}>Recommended: Free Forever Setup</h3>
            <p className={`text-xs ${theme.text.tertiary} leading-relaxed`}>
              Local Whisper (free transcription) + Gemini API (1M free tokens/day) = completely free!
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Transcription Choice */}
      <div className={`${theme.glass.primary} ${theme.radius.xl} p-5 ${theme.shadow} mb-4`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white">1</div>
          <h3 className={`text-sm font-semibold ${theme.text.primary}`}>Choose Transcription Method</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Local Whisper Option */}
          <button
            onClick={toggleLocalWhisper}
            className={`p-4 rounded-xl text-left transition-all ${
              useLocalWhisper 
                ? 'bg-green-500/10 border-2 border-green-500/40' 
                : 'bg-white/5 border-2 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-green-400">FREE</span>
              {useLocalWhisper && (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h4 className={`text-sm font-medium ${theme.text.primary} mb-1`}>Local Whisper</h4>
            <p className={`text-xs ${theme.text.tertiary}`}>Runs on your Mac, 100% offline</p>
          </button>

          {/* Deepgram Option */}
          <button
            onClick={() => setUseLocalWhisper(false)}
            className={`p-4 rounded-xl text-left transition-all ${
              !useLocalWhisper 
                ? 'bg-blue-500/10 border-2 border-blue-500/40' 
                : 'bg-white/5 border-2 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-400">$200 FREE</span>
              {!useLocalWhisper && (
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h4 className={`text-sm font-medium ${theme.text.primary} mb-1`}>Deepgram Cloud</h4>
            <p className={`text-xs ${theme.text.tertiary}`}>Fastest, real-time streaming</p>
          </button>
        </div>

        {/* Deepgram Key Input (only show if cloud selected) */}
        {!useLocalWhisper && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-medium ${theme.text.secondary}`}>Deepgram API Key</label>
              <button
                onClick={() => openExternalLink('https://console.deepgram.com/')}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Get free key ($200 credits) →
              </button>
            </div>
            <div className="relative">
              <input
                type={showDeepgramKey ? 'text' : 'password'}
                value={deepgramKey}
                onChange={(e) => setDeepgramKey(e.target.value)}
                placeholder="Enter your Deepgram API key"
                className="w-full bg-black/40 rounded-lg px-4 py-2.5 pr-16 text-white placeholder-white/40 border border-white/20 focus:border-blue-500/50 focus:outline-none transition-colors font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowDeepgramKey(!showDeepgramKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
              >
                {showDeepgramKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: AI Key (Required) */}
      <div className={`${theme.glass.primary} ${theme.radius.xl} p-5 ${theme.shadow} mb-4`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white">2</div>
          <h3 className={`text-sm font-semibold ${theme.text.primary}`}>Add Gemini API Key</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">
            Required
          </span>
        </div>
        
        <p className={`text-xs ${theme.text.tertiary} mb-3`}>
          Gemini formats your speech, fixes grammar, and powers AI commands. Free tier: 1M tokens/day!
        </p>
        
        <div className="flex items-center justify-between mb-2">
          <label className={`text-xs font-medium ${theme.text.secondary}`}>Gemini API Key</label>
          <button
            onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Get free key →
          </button>
        </div>
        <div className="relative">
          <input
            type={showGeminiKey ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className={`w-full bg-black/40 rounded-lg px-4 py-2.5 pr-16 text-white placeholder-white/40 border ${
              geminiKey.trim() ? 'border-green-500/40' : 'border-amber-500/40'
            } focus:border-white/50 focus:outline-none transition-colors font-mono text-xs`}
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
          >
            {showGeminiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {!geminiKey.trim() && (
          <p className={`text-xs text-amber-400 mt-2 flex items-center gap-1`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Required for AI formatting and commands
          </p>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full ${theme.glass.secondary} ${theme.text.primary} px-6 py-3 ${theme.radius.lg} font-medium hover:bg-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-white/20`}
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </>
        ) : saved ? (
          <>
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </>
        ) : (
          'Save Settings'
        )}
      </button>

      {/* Status summary */}
      <div className="mt-4 text-center">
        <p className={`text-xs ${theme.text.tertiary}`}>
          {useLocalWhisper ? '🖥️ Local Whisper' : '☁️ Deepgram Cloud'} 
          {' + '}
          {geminiKey.trim() ? '✅ Gemini AI' : '⚠️ No AI key yet'}
        </p>
      </div>
    </div>
  );
};

export default ApiKeySetupScreen;
