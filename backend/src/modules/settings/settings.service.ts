import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(__dirname, '../../../data/settings.json');

// Default settings
const defaultSettings: any = {
  tutorialVideos: {
    platformRules: {
      title: 'Platforma ishlatish qoidalari',
      youtubeUrl: '',
      description: 'Platformadan foydalanish bo\'yicha qo\'llanma video',
    },
    normativeRules: {
      title: 'Normativ qoidalari bajarish',
      youtubeUrl: '',
      description: 'Normativlarni qanday bajarish kerakligi haqida video',
    },
    obsStudio: {
      title: 'OBS Studio o\'rnatish va sozlash',
      youtubeUrl: '',
      description: 'OBS Studio dasturini o\'rnatish va sozlash bo\'yicha qo\'llanma',
    },
    youtubeChannel: {
      title: 'YouTube kanal ochish va video joylash',
      youtubeUrl: '',
      description: 'YouTube kanalini qanday ochish va video joylash bo\'yicha qo\'llanma',
    },
  },
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash',
};

class SettingsService {
  private ensureDataDir() {
    const dataDir = path.join(__dirname, '../../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private readSettings(): typeof defaultSettings {
    this.ensureDataDir();
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch (error) {
      console.error('Settings read error:', error);
    }
    return defaultSettings;
  }

  private writeSettings(settings: typeof defaultSettings) {
    this.ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /**
   * Tutorial videolarni olish
   */
  async getTutorialVideos() {
    const settings = this.readSettings();
    return settings.tutorialVideos;
  }

  /**
   * Tutorial videolarni yangilash (admin)
   */
  async updateTutorialVideos(data: {
    platformRules?: { youtubeUrl: string; title?: string; description?: string };
    normativeRules?: { youtubeUrl: string; title?: string; description?: string };
    obsStudio?: { youtubeUrl: string; title?: string; description?: string };
    youtubeChannel?: { youtubeUrl: string; title?: string; description?: string };
  }) {
    const settings = this.readSettings();

    if (data.platformRules) {
      settings.tutorialVideos.platformRules = {
        ...settings.tutorialVideos.platformRules,
        ...data.platformRules,
      };
    }

    if (data.normativeRules) {
      settings.tutorialVideos.normativeRules = {
        ...settings.tutorialVideos.normativeRules,
        ...data.normativeRules,
      };
    }

    if (data.obsStudio) {
      (settings.tutorialVideos as any).obsStudio = {
        ...(settings.tutorialVideos as any).obsStudio,
        ...data.obsStudio,
      };
    }

    if (data.youtubeChannel) {
      (settings.tutorialVideos as any).youtubeChannel = {
        ...(settings.tutorialVideos as any).youtubeChannel,
        ...data.youtubeChannel,
      };
    }

    this.writeSettings(settings);
    return settings.tutorialVideos;
  }

  /**
   * Gemini konfiguratsiyasini olish
   * API key ni bermaydi (faqat isConfigured qaytaradi)
   */
  async getGeminiStatus() {
    const settings = this.readSettings();
    return {
      isConfigured: !!(settings as any).geminiApiKey,
      model: (settings as any).geminiModel || 'gemini-3.5-flash',
    };
  }

  /**
   * Gemini konfiguratsiyasini yangilash (admin only)
   */
  async updateGeminiConfig(data: { apiKey?: string; model?: string }) {
    const settings = this.readSettings();
    if (data.apiKey !== undefined) (settings as any).geminiApiKey = data.apiKey;
    if (data.model !== undefined) (settings as any).geminiModel = data.model;
    this.writeSettings(settings);
    return { isConfigured: !!(settings as any).geminiApiKey, model: (settings as any).geminiModel };
  }

  /**
   * Gemini API key ni test qilish
   */
  async testGeminiConfig() {
    const settings = this.readSettings();
    const apiKey = (settings as any).geminiApiKey;
    const model = (settings as any).geminiModel || 'gemini-3.5-flash';

    if (!apiKey) return { success: false, message: 'API key kiritilmagan' };

    try {
      // Yangi AQ. format yoki eski AIza format uchun to'g'ri auth usuli
      const isNewFormat = apiKey.startsWith('AQ.');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent${isNewFormat ? '' : `?key=${apiKey}`}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isNewFormat) headers['Authorization'] = `Bearer ${apiKey}`;
      else headers['x-goog-api-key'] = apiKey;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
      });
      if (response.ok) return { success: true, message: 'Gemini ishlayapti ✅' };
      const errText = await response.text();
      console.error('Gemini test error:', errText);
      return { success: false, message: 'API key noto\'g\'ri ❌' };
    } catch {
      return { success: false, message: 'Gemini API bilan bog\'lanib bo\'lmadi' };
    }
  }
}

export default new SettingsService();
