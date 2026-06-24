import fs from 'fs';
import path from 'path';

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

  if (provider === 'groq') {
    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    });

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
    const response = await fetch(
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
      }
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
