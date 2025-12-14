import { GoogleGenAI, Chat, Content } from "@google/genai";
import { ChatMessage } from "../types";

export interface CustomSession {
  isCustom: true;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: { role: string; content: string }[];
}

export type UnifiedChatSession = Chat | CustomSession;

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<UnifiedChatSession> => {
  
  // Resolve API Key
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : process.env.API_KEY;
  
  if (!apiKey) {
      console.warn("API Key warning: No valid key found.");
  }

  // Detect Provider Strategy
  const isGenericEndpoint = baseUrl && (
    baseUrl.includes('huggingface') || 
    baseUrl.includes('deepseek') || 
    baseUrl.includes('openai') || 
    baseUrl.includes('v1') ||
    !modelName.toLowerCase().includes('gemini') 
  );

  if (isGenericEndpoint) {
    return {
      isCustom: true,
      modelName,
      baseUrl: baseUrl!.replace(/\/$/, ''),
      apiKey: apiKey || '',
      systemInstruction,
      history: history
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text
        }))
    };
  }

  // Google GenAI SDK Initialization
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const formattedHistory: Content[] = history
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction: systemInstruction,
    },
    history: formattedHistory,
  });

  return chat;
};

export const sendMessageToGemini = async (
  session: UnifiedChatSession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  // Custom Endpoint (OpenAI Compatible)
  if ('isCustom' in session) {
      const customSession = session as CustomSession;
      try {
        const payload = {
            model: customSession.modelName,
            messages: [
                { role: "system", content: customSession.systemInstruction },
                ...customSession.history,
                { role: "user", content: message }
            ],
            stream: false
        };

        const endpoint = `${customSession.baseUrl}/chat/completions`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customSession.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`External API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "";

        if (!reply) throw new Error("Empty response from external model.");

        customSession.history.push({ role: 'user', content: message });
        customSession.history.push({ role: 'assistant', content: reply });

        return reply;

      } catch (error: any) {
          console.error("Custom Endpoint Error:", error);
          throw new Error(`UPLINK FAILED: ${error.message}`);
      }
  }

  // Google GenAI SDK
  try {
    const chat = session as Chat;
    const response = await chat.sendMessage({
      message: message,
    });
    
    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.toString().includes('403')) {
        throw new Error("ACCESS_DENIED: API Key invalid or quota exceeded.");
    }
    throw new Error(`UPLINK FAILED: ${error.message || "Connection dropped"}`);
  }
};