
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
  // Guidelines: API key must be obtained exclusively from the environment variable process.env.API_KEY
  const envKey = process.env.API_KEY || '';
  
  // Use envKey for Gemini or passed key for custom endpoints
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey && !baseUrl) throw new Error("AUTHENTICATION_REQUIRED");

  // Logic: Non-google endpoints are generic OpenAI-compat
  const isGeneric = !!(baseUrl && !baseUrl.includes('googleapis.com'));
  
  return {
    modelName,
    baseUrl,
    apiKey,
    systemInstruction,
    history: [...history],
    isGeneric
  };
};

export const sendMessageToGemini = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) throw new Error("SESSION_NULL");

  // --- PATH A: GENERIC OPENAI-COMPATIBLE ---
  if (session.isGeneric) {
    let endpoint = session.baseUrl || '';
    if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
    }
    
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

      if (!response.ok) {
          const raw = await response.text();
          throw new Error(`PROVIDER_REJECTION: ${response.status}. ${raw.substring(0, 100)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No response content.";
    } catch (err: any) {
      throw new Error(`UPLINK_FAILURE: ${err.message}`);
    }
  }

  // --- PATH B: GOOGLE GENAI SDK ---
  try {
    // Guidelines: Always initialize with new GoogleGenAI({apiKey: process.env.API_KEY})
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Format history for generateContent
    const contents = session.history.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Guidelines: Always use ai.models.generateContent with model and contents together
    const response = await ai.models.generateContent({
      model: session.modelName,
      contents,
      config: { 
        systemInstruction: session.systemInstruction, 
        temperature: 0.7 
      }
    });

    // Guidelines: Access text as a property on the response object
    return response.text || "";
  } catch (err: any) {
    throw new Error(`GEMINI_ERROR: ${err.message}`);
  }
};
