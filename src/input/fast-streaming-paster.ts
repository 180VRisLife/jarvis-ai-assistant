import { Logger } from '../core/logger';

/**
 * Ultra-fast streaming text paster that bypasses all processing
 * for minimal latency from speech end to paste
 */
export class FastStreamingPaster {
  private static clipboardBackup: string | null = null;
  private static lastPasteTime: number = 0;
  private static lastPastedText: string = '';
  private static SPACE_TIMEOUT = 10000; // 10 seconds - add space if pasting within this window
  
  /**
   * Paste text as fast as possible with minimal processing
   * Uses native clipboard method for speed and adds smart spacing
   */
  static async pasteFast(text: string): Promise<void> {
    const pasteStartTime = Date.now();
    const keyReleaseTime = (global as any).keyReleaseTime || pasteStartTime;
    
    Logger.performance(`⚡ [FAST-PASTE] Starting immediate paste`, pasteStartTime - keyReleaseTime);
    
    if (!text?.trim()) {
      Logger.warning('⚡ [FAST-PASTE] No text to paste');
      return;
    }
    
    // Add smart spacing for hands-free experience using simple time-based logic
    const smartText = this.addSimpleSmartSpacing(text);
    
    try {
      // Try native method first (fastest)
      // Returns true on success, false if module unavailable (fall back), throws on paste failure
      const nativeSuccess = await this.tryNativePaste(smartText);
      if (nativeSuccess) {
        this.lastPasteTime = Date.now();
        this.lastPastedText = smartText;
        const totalTime = Date.now() - keyReleaseTime;
        Logger.performance(`⚡ [FAST-PASTE] Native paste complete`, Date.now() - pasteStartTime);
        Logger.performance(`✅ [TIMING] ULTRA-FAST END-TO-END`, totalTime);

        // Schedule clipboard write AFTER native module's 1.5s restoration
        // so clipboard managers (Raycast, etc.) capture the transcription
        this.scheduleClipboardWrite(smartText);
        return;
      }

      // Native returned false - module not available, fall back to AppleScript
      // Note: AppleScript can't detect if paste actually worked, so we assume success
      await this.tryAppleScriptPaste(smartText);
      this.lastPasteTime = Date.now();
      this.lastPastedText = smartText;
      const totalTime = Date.now() - keyReleaseTime;
      Logger.performance(`⚡ [FAST-PASTE] AppleScript paste complete`, Date.now() - pasteStartTime);
      Logger.performance(`✅ [TIMING] FAST END-TO-END`, totalTime);

      // Also write to clipboard for AppleScript path (no restoration happens but ensures capture)
      this.scheduleClipboardWrite(smartText);
    } catch (error) {
      Logger.error('⚡ [FAST-PASTE] All methods failed:', error);
      const totalTime = Date.now() - keyReleaseTime;
      Logger.performance(`❌ [TIMING] FAILED END-TO-END`, totalTime);

      // Copy to clipboard so clipboard managers (Raycast, etc.) can capture it
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(smartText);
        Logger.info('📋 [FAST-PASTE] Text copied to clipboard as backup for clipboard managers');
      } catch (clipboardError) {
        Logger.error('📋 [FAST-PASTE] Clipboard backup failed:', clipboardError);
      }

      // Re-throw so caller knows paste failed
      throw error;
    }
  }
  
  /**
   * Add smart spacing and capitalization using simple time-based logic for hands-free experience
   * Much faster than cursor inspection - adds space if pasting within 10 seconds of last paste
   */
  private static addSimpleSmartSpacing(text: string): string {
    const now = Date.now();
    const timeSinceLastPaste = now - this.lastPasteTime;
    
    // If we pasted something recently (within 10 seconds), add a space before new text
    if (this.lastPasteTime > 0 && timeSinceLastPaste < this.SPACE_TIMEOUT) {
      // Check if last text ended with sentence-ending punctuation
      const lastTextEndsWithSentence = this.lastPastedText && /[.!?]"?\s*$/.test(this.lastPastedText.trim());
      
      // Add space
      const spacedText = ` ${text}`;
      
      // Only adjust capitalization if the previous text didn't end a sentence
      const adjustedText = lastTextEndsWithSentence ? spacedText : this.adjustContinuationCapitalization(spacedText);
      
      Logger.info(`🔤 [Smart Spacing] Adding space${lastTextEndsWithSentence ? ' (new sentence)' : ' and adjusting caps'} (${timeSinceLastPaste}ms since last paste): "${adjustedText}"`);
      return adjustedText;
    }
    
    Logger.debug(`🔤 [Smart Spacing] No space needed (${timeSinceLastPaste}ms since last paste): "${text}"`);
    return text;
  }

  /**
   * Adjust capitalization for text that continues a previous sentence
   * Converts first letter to lowercase unless it's a proper noun or should remain capitalized
   */
  private static adjustContinuationCapitalization(text: string): string {
    if (!text || text.length < 2) return text;
    
    // Skip if text doesn't start with space + capital letter
    if (text[0] !== ' ' || !/[A-Z]/.test(text[1])) return text;
    
    const firstWord = text.substring(1).split(/[\s,.!?;:]+/)[0];
    
    // Don't lowercase if it's likely a proper noun (keep common proper nouns capitalized)
    const properNouns = new Set([
      'I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December', 'Google', 'Apple', 'Microsoft',
      'Amazon', 'Facebook', 'Twitter', 'LinkedIn', 'GitHub', 'OpenAI', 'ChatGPT',
      'Jarvis', 'CEO', 'API', 'AI', 'ML', 'USA', 'UK', 'EU'
    ]);
    
    // Keep capitalized if it's a known proper noun
    if (properNouns.has(firstWord)) {
      Logger.debug(`🔤 [Capitalization] Keeping capitalized (proper noun): "${firstWord}"`);
      return text;
    }
    
    // Check if this might be the start of a quoted sentence
    if (text.trim().startsWith('"') || text.trim().startsWith("'")) {
      Logger.debug(`🔤 [Capitalization] Keeping capitalized (quoted text): "${firstWord}"`);
      return text;
    }
    
    // If the word is all caps (like "VERY"), keep it as is
    if (firstWord === firstWord.toUpperCase() && firstWord.length > 1) {
      Logger.debug(`🔤 [Capitalization] Keeping all caps: "${firstWord}"`);
      return text;
    }
    
    // Convert first letter to lowercase for natural continuation
    const adjustedText = ` ${text[1].toLowerCase()}${text.substring(2)}`;
    Logger.debug(`🔤 [Capitalization] Adjusted for continuation: "${firstWord}" -> "${adjustedText.substring(1).split(' ')[0]}"`);
    return adjustedText;
  }
  
  /**
   * Try native paste method (fastest)
   * Returns: true if paste succeeded, false if module not available, throws if paste failed
   */
  private static async tryNativePaste(text: string): Promise<boolean> {
    try {
      let typingMonitor;
      try {
        typingMonitor = require('typing_monitor');
      } catch (error) {
        return false; // Module not available, should fall back
      }

      if (typeof typingMonitor.fastPasteText !== 'function') {
        return false; // Function not available, should fall back
      }

      const success = typingMonitor.fastPasteText(text);
      if (success) {
        Logger.info(`⚡ [FAST-PASTE] Native method succeeded: "${text}"`);
        return true;
      }

      // Native module available but paste failed - this means no text input focused
      throw new Error('NO_TEXT_INPUT');
    } catch (error: any) {
      // Re-throw paste failure errors
      if (error.message === 'NO_TEXT_INPUT') {
        throw error;
      }
      return false; // Other errors mean we should try fallback
    }
  }
  
  /**
   * Minimal AppleScript paste (no delays)
   */
  private static async tryAppleScriptPaste(text: string): Promise<void> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Direct clipboard paste (fastest AppleScript method)
      const copyProcess = spawn('pbcopy');
      copyProcess.stdin.write(text);
      copyProcess.stdin.end();
      
      copyProcess.on('close', (code) => {
        if (code === 0) {
          // Immediate paste
          const pasteScript = 'tell application "System Events" to keystroke "v" using command down';
          const pasteProcess = spawn('osascript', ['-e', pasteScript]);
          
          pasteProcess.on('close', (pasteCode) => {
            if (pasteCode === 0) {
              Logger.info(`⚡ [FAST-PASTE] AppleScript succeeded in ${Date.now() - startTime}ms`);
              resolve();
            } else {
              reject(new Error(`Paste failed: ${pasteCode}`));
            }
          });
          
          // Very short timeout
          setTimeout(() => {
            pasteProcess.kill();
            reject(new Error('Paste timeout'));
          }, 500);
        } else {
          reject(new Error(`Copy failed: ${code}`));
        }
      });
      
      // Very short timeout for copy
      setTimeout(() => {
        copyProcess.kill();
        reject(new Error('Copy timeout'));
      }, 200);
    });
  }

  /**
   * Schedule clipboard write after native module's restoration (1.5s)
   * This ensures clipboard managers like Raycast capture the transcription
   */
  private static scheduleClipboardWrite(text: string): void {
    // Wait 2 seconds (after native module's 1.5s restoration) then write to clipboard
    setTimeout(() => {
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        Logger.info('📋 [FAST-PASTE] Text written to clipboard for clipboard managers');
      } catch (error) {
        Logger.error('📋 [FAST-PASTE] Scheduled clipboard write failed:', error);
      }
    }, 2000);
  }
}
