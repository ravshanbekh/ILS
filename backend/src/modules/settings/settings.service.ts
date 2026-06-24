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
  geminiModel: 'gemini-2.5-flash',
  centerContext: '',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  aiProvider: 'gemini',
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
   * Gemini va Groq konfiguratsiyasini olish
   * API key ni bermaydi (faqat isConfigured va isGroqConfigured qaytaradi)
   */
  async getGeminiStatus() {
    const settings = this.readSettings();
    return {
      isConfigured: !!(settings as any).geminiApiKey,
      model: (settings as any).geminiModel || 'gemini-2.5-flash',
      centerContext: (settings as any).centerContext || '',
      isGroqConfigured: !!(settings as any).groqApiKey,
      groqModel: (settings as any).groqModel || 'llama-3.3-70b-versatile',
      aiProvider: (settings as any).aiProvider || 'gemini',
    };
  }

  /**
   * AI konfiguratsiyasini yangilash (admin only)
   */
  async updateGeminiConfig(data: {
    apiKey?: string;
    model?: string;
    centerContext?: string;
    groqApiKey?: string;
    groqModel?: string;
    aiProvider?: string;
  }) {
    const settings = this.readSettings();
    if (data.apiKey !== undefined) (settings as any).geminiApiKey = data.apiKey;
    if (data.model !== undefined) (settings as any).geminiModel = data.model;
    if (data.centerContext !== undefined) (settings as any).centerContext = data.centerContext;
    if (data.groqApiKey !== undefined) (settings as any).groqApiKey = data.groqApiKey;
    if (data.groqModel !== undefined) (settings as any).groqModel = data.groqModel;
    if (data.aiProvider !== undefined) (settings as any).aiProvider = data.aiProvider;
    this.writeSettings(settings);
    return {
      isConfigured: !!(settings as any).geminiApiKey,
      model: (settings as any).geminiModel,
      centerContext: (settings as any).centerContext,
      isGroqConfigured: !!(settings as any).groqApiKey,
      groqModel: (settings as any).groqModel,
      aiProvider: (settings as any).aiProvider,
    };
  }

  /**
   * AI API key ni test qilish
   */
  async testGeminiConfig() {
    const settings = this.readSettings();
    const provider = (settings as any).aiProvider || 'gemini';

    if (provider === 'groq') {
      const apiKey = (settings as any).groqApiKey;
      const model = (settings as any).groqModel || 'llama-3.3-70b-versatile';

      if (!apiKey) return { success: false, message: 'Groq API key kiritilmagan' };

      try {
        const response = await fetch(
          `https://api.groq.com/openai/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 10,
            }),
          }
        );
        if (response.ok) return { success: true, message: 'Groq ishlayapti ✅' };
        const errText = await response.text();
        console.error('Groq test error:', errText);
        try {
          const parsed = JSON.parse(errText);
          const errMsg = parsed.error?.message || 'Noma\'lum xato';
          return { success: false, message: `Groq API xatoligi: ${errMsg} ❌` };
        } catch {
          return { success: false, message: `Groq API xatoligi (${response.status}): ${errText.substring(0, 100)} ❌` };
        }
      } catch (e: any) {
        return { success: false, message: `Groq API bilan bog'lanib bo'lmadi: ${e.message || e}` };
      }
    } else {
      const apiKey = (settings as any).geminiApiKey;
      const model = (settings as any).geminiModel || 'gemini-2.5-flash';

      if (!apiKey) return { success: false, message: 'Gemini API key kiritilmagan' };

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
          }
        );
        if (response.ok) return { success: true, message: 'Gemini ishlayapti ✅' };
        const errText = await response.text();
        console.error('Gemini test error:', errText);
        try {
          const parsed = JSON.parse(errText);
          const errMsg = parsed.error?.message || 'Noma\'lum xato';
          const errCode = parsed.error?.code || response.status;
          return { success: false, message: `API xatoligi (${errCode}): ${errMsg} ❌` };
        } catch {
          return { success: false, message: `API xatoligi (${response.status}): ${errText.substring(0, 100)} ❌` };
        }
      } catch (e: any) {
        return { success: false, message: `Gemini API bilan bog'lanib bo'lmadi: ${e.message || e}` };
      }
    }
  }
}

export default new SettingsService();
