
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

export interface AISession {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
  isGeneric: boolean;
}

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  const envKey = process.env.API_KEY || '';
  let apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (apiKey) {
    apiKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();
  }

  if (!apiKey) {
    throw new Error("MISSING_API_KEY: No valid API key found.");
  }

  const isGoogle = (baseUrl && baseUrl.includes('googleapis.com')) || 
                   (!baseUrl && modelName.toLowerCase().startsWith('gemini'));
  
  return {
    modelName,
    baseUrl,
    apiKey,
    systemInstruction,
    history: [...history],
    isGeneric: !isGoogle
  };
};

export const sendMessageToGemini = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) throw new Error("SESSION_INVALID");

  if (session.isGeneric) {
    // OpenAI Compatible Path
    const endpoint = session.baseUrl || 'https://api.openai.com/v1/chat/completions';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.apiKey}`
        },
        body: JSON.stringify({
          model: session.modelName,
          messages: [
            { role: "system", content: session.systemInstruction },
            ...session.history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
            { role: "user", content: message }
          ]
        })
      });

      // FIX: Check if response is OK before parsing JSON to avoid "Unexpected token N" error
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API UPLINK ERROR: ${response.status} ${response.statusText}. ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No response content from provider.";
    } catch (err: any) {
      throw new Error(`CONNECTION FAILED: ${err.message}`);
    }
  }

  // Google Gemini Path (Strict SDK Usage)
  try {
    const ai = new GoogleGenAI({ apiKey: session.apiKey });
    const contents = session.history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: session.modelName,
      contents: contents,
      config: {
        systemInstruction: session.systemInstruction,
        temperature: 0.8,
      }
    });

    const reply = response.text;
    if (!reply) throw new Error("Empty response from Gemini");

    return reply;
  } catch (err: any) {
    throw new Error(`GEMINI SDK ERROR: ${err.message}`);
  }
};
