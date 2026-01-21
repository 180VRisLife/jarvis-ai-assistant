import * as fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Logger } from '../core/logger';

interface NudgeConfig {
  enabled: boolean;
  frequency: 'low' | 'medium' | 'high';
  maxNudgesPerDay: number;
  snoozeTime: number;
  smartNudging: boolean;
  minTypingDuration: number;
  dismissedPermanently: boolean;
}

interface UserActivity {
  lastTypingTime: number;
  lastJarvisUsage: number;
  typingStreakCount: number;
  firstTypingTime: number;
  typingSessionDuration: number;
  lastPauseTime: number;
  currentSessionId: string;
  nudgedInCurrentSession: boolean;
  todayNudgeCount: number;
  lastNudgeDate: string;
  totalNudgesShown: number;
  jarvisUsageCount: number;
}

export class NudgeConfigManager {
  private configPath: string;
  private activityPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'nudge-config.json');
    this.activityPath = path.join(userDataPath, 'user-activity.json');
  }

  loadConfig(): NudgeConfig {
    const defaultConfig: NudgeConfig = {
      enabled: true,
      frequency: 'medium',
      maxNudgesPerDay: 3,
      snoozeTime: 15,
      smartNudging: true,
      minTypingDuration: 120,
      dismissedPermanently: false
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = { ...defaultConfig, ...JSON.parse(configData) };
        Logger.debug('🔔 [Nudge] Config loaded:', config);
        return config;
      }
    } catch (error) {
      Logger.error('🔔 [Nudge] Error loading config:', error);
    }

    Logger.debug('🔔 [Nudge] Using default config');
    return defaultConfig;
  }

  loadActivity(): UserActivity {
    const defaultActivity: UserActivity = {
      lastTypingTime: 0,
      lastJarvisUsage: 0,
      typingStreakCount: 0,
      firstTypingTime: 0,
      typingSessionDuration: 0,
      lastPauseTime: 0,
      currentSessionId: '',
      nudgedInCurrentSession: false,
      todayNudgeCount: 0,
      lastNudgeDate: '',
      totalNudgesShown: 0,
      jarvisUsageCount: 0
    };

    try {
      if (fs.existsSync(this.activityPath)) {
        const activityData = fs.readFileSync(this.activityPath, 'utf8');
        const activity = { ...defaultActivity, ...JSON.parse(activityData) };
        
        const today = new Date().toDateString();
        if (activity.lastNudgeDate !== today) {
          activity.todayNudgeCount = 0;
          activity.lastNudgeDate = today;
        }
        
        Logger.debug('🔔 [Nudge] Activity loaded');
        return activity;
      }
    } catch (error) {
      Logger.error('🔔 [Nudge] Error loading activity:', error);
    }

    Logger.debug('🔔 [Nudge] Using default activity');
    return defaultActivity;
  }

  saveConfig(config: NudgeConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      Logger.debug('🔔 [Nudge] Config saved');
    } catch (error) {
      Logger.error('🔔 [Nudge] Error saving config:', error);
    }
  }

  saveActivity(activity: UserActivity): void {
    try {
      fs.writeFileSync(this.activityPath, JSON.stringify(activity, null, 2));
    } catch (error) {
      Logger.error('🔔 [Nudge] Error saving activity:', error);
    }
  }

  updateConfig(config: NudgeConfig, newConfig: Partial<NudgeConfig>): NudgeConfig {
    const updatedConfig = { ...config, ...newConfig };
    this.saveConfig(updatedConfig);
    Logger.debug('🔔 [Nudge] Config updated:', newConfig);
    return updatedConfig;
  }

  resetDailyCount(activity: UserActivity): UserActivity {
    const today = new Date().toDateString();
    activity.todayNudgeCount = 0;
    activity.lastNudgeDate = today;
    this.saveActivity(activity);
    Logger.debug('🔔 [Nudge] Daily nudge count reset');
    return activity;
  }

  recordJarvisUsage(activity: UserActivity): UserActivity {
    const now = Date.now();
    activity.lastJarvisUsage = now;
    activity.jarvisUsageCount++;
    
    if (activity.nudgedInCurrentSession) {
      Logger.debug('🔔 [Nudge] Jarvis used after nudge - success!');
    }
    
    Logger.debug(`🔔 [Nudge] Jarvis usage recorded (total: ${activity.jarvisUsageCount})`);
    this.saveActivity(activity);
    return activity;
  }

  recordTypingActivity(activity: UserActivity): UserActivity {
    const now = Date.now();
    activity.lastTypingTime = now;
    
    const timeSinceLastActivity = now - activity.lastTypingTime;
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      Logger.debug('🔔 [Nudge] New typing session detected after break');
      activity.firstTypingTime = now;
      activity.typingSessionDuration = 0;
      activity.typingStreakCount = 0;
      activity.nudgedInCurrentSession = false;
    }
    
    activity.typingStreakCount++;
    if (activity.firstTypingTime === 0) {
      activity.firstTypingTime = now;
    }
    activity.typingSessionDuration = now - activity.firstTypingTime;
    
    this.saveActivity(activity);
    return activity;
  }

  snooze(activity: UserActivity, snoozeTime: number): UserActivity {
    const snoozeUntil = Date.now() + (snoozeTime * 60 * 1000);
    activity.lastJarvisUsage = snoozeUntil;
    Logger.debug(`🔔 [Nudge] Snoozed for ${snoozeTime} minutes`);
    this.saveActivity(activity);
    return activity;
  }

  debugStatus(config: NudgeConfig, activity: UserActivity): void {
    Logger.debug('\n🔔 [Nudge] === DEBUG STATUS ===');
    Logger.debug('  📋 Configuration:');
    Logger.debug(`    - Enabled: ${config.enabled}`);
    Logger.debug(`    - Dismissed permanently: ${config.dismissedPermanently}`);
    Logger.debug(`    - Frequency: ${config.frequency}`);
    Logger.debug(`    - Max nudges per day: ${config.maxNudgesPerDay}`);
    Logger.debug(`    - Smart nudging: ${config.smartNudging}`);
    Logger.debug(`    - Min typing duration: ${config.minTypingDuration}s`);
    
    Logger.debug('  📊 Activity:');
    Logger.debug(`    - Today's nudge count: ${activity.todayNudgeCount}`);
    Logger.debug(`    - Total nudges shown: ${activity.totalNudgesShown}`);
    Logger.debug(`    - Jarvis usage count: ${activity.jarvisUsageCount}`);
    Logger.debug(`    - Nudged in current session: ${activity.nudgedInCurrentSession}`);
    Logger.debug(`    - Current session ID: ${activity.currentSessionId}`);
    Logger.debug(`    - Typing session duration: ${Math.round(activity.typingSessionDuration/1000)}s`);
    
    const now = Date.now();
    const timeSinceLastJarvis = now - activity.lastJarvisUsage;
    const timeSinceLastTyping = now - activity.lastTypingTime;
    Logger.debug(`    - Time since last Jarvis: ${Math.round(timeSinceLastJarvis/1000)}s`);
    Logger.debug(`    - Time since last typing: ${Math.round(timeSinceLastTyping/1000)}s`);
    
    Logger.debug('  📁 Files:');
    Logger.debug(`    - Config path: ${this.configPath}`);
    Logger.debug(`    - Activity path: ${this.activityPath}`);
    
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        
        if (fileConfig.enabled !== config.enabled) {
          Logger.debug('  ⚠️  CONFIG MISMATCH! File says enabled:', fileConfig.enabled, 'but service has:', config.enabled);
        }
      } catch (error) {
        Logger.debug('  ❌ Error reading config file:', error.message);
      }
    } else {
      Logger.debug('  📄 Config file does not exist');
    }
  }
}
