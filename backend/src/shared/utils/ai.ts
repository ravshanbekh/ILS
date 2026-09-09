import fs from 'fs';
import path from 'path';

/**
 * Tashqi AI API ga so'rov qancha kutilishi mumkin.
 * Ilgari timeout umuman yo'q edi: provayder sekinlashsa yoki osilib qolsa,
 * har bir chaqiruv server ulanishini cheksiz band qilib turardi.
 */
export const AI_REQUEST_TIMEOUT_MS = 25_000;

/** fetch, lekin belgilangan vaqtdan keyin uziladi */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('AI_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface AISettings {
  apiKey: string;
  model: string;
  provider: 'gemini' | 'groq';
  centerContext: string;
}

export function getAISettings(): AISettings {
  const settingsPath = path.join(__dirname, '../../../data/settings.json');
  let geminiApiKey = '';
  let geminiModel = 'gemini-2.5-flash';
  let groqApiKey = '';
  let groqModel = 'llama-3.3-70b-versatile';
  let aiProvider = 'gemini';
  let centerContext = '';

  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const s = JSON.parse(raw);
      geminiApiKey = s.geminiApiKey || '';
      geminiModel = s.geminiModel || 'gemini-2.5-flash';
      groqApiKey = s.groqApiKey || '';
      groqModel = s.groqModel || 'llama-3.3-70b-versatile';
      aiProvider = s.aiProvider || 'gemini';
      centerContext = s.centerContext || '';
    }
  } catch (error) {
    console.error('Error reading AI settings:', error);
  }

  const provider = aiProvider === 'groq' ? 'groq' : 'gemini';
  const apiKey = provider === 'groq' ? groqApiKey : geminiApiKey;
  const model = provider === 'groq' ? groqModel : geminiModel;

  return { apiKey, model, provider, centerContext };
}

/**
 * Generates text using the configured AI provider (Gemini or Groq).
 * Removes any markdown characters (*, **, #, `) from the output before returning.
 */
export async function generateText(
  prompt: string,
  maxTokens: number = 65536,
  temperature: number = 0.7,
  cleanMarkdown: boolean = true
): Promise<string> {
  const { apiKey, model, provider } = getAISettings();
  if (!apiKey) {
    throw new Error('API_KEY_NOT_SET');
  }

  // Tashqi AI API osilib qolsa, so'rov cheksiz kutib turmasligi kerak edi —
  // aks holda bir nechta osilgan chaqiruv server ulanishlarini band qilib
  // qo'yadi (arzon so'rov -> qimmat kutish, DoS uchun qulay nishon).
  const timeoutMs = AI_REQUEST_TIMEOUT_MS;

  if (provider === 'groq') {
    // Call Groq API
    const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(maxTokens, 8192), // Groq llama-3.3-70b-versatile limit is 8192
        temperature: temperature,
      }),
    }, timeoutMs);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API Error:', errText);
      throw new Error('GEMINI_API_ERROR'); // Throwing GEMINI_API_ERROR to maintain compatibility with existing controllers
    }

    const data: any = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    
    // Markdown cleaning
    if (cleanMarkdown) {
      text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##+ /g, '').replace(/`/g, '');
    }
    return text.trim();
  } else {
    // Call Gemini API
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw new Error('GEMINI_API_ERROR');
    }

    const data: any = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = parts.map((p: any) => p.text).join('') || '';

    // Markdown cleaning
    if (cleanMarkdown) {
      text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##+ /g, '').replace(/`/g, '');
    }
    return text.trim();
  }
}
