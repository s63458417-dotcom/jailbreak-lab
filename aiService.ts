
import { ChatMessage } from "./types";

export interface AISession {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
}

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  return {
    modelName: modelName || '',
    baseUrl: baseUrl || '',
    apiKey: customApiKey || '',
    systemInstruction,
    history: [...history]
  };
};

export const sendMessageToAI = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session.baseUrl) throw new Error("MISSING_ENDPOINT: Set Base URL in Admin.");
  
  const endpoint = session.baseUrl;
  const isGoogleNative = endpoint.includes('generativelanguage.googleapis.com');
  
  try {
    let body: any;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (isGoogleNative) {
      // --- NATIVE GEMINI PROTOCOL ---
      headers['x-goog-api-key'] = session.apiKey;
      body = {
        contents: [
          ...session.history.map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ],
        systemInstruction: {
          parts: [{ text: session.systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      };
    } else {
      // --- OPENAI / GENERIC PROTOCOL (Gopher, Gock, HuggingFace, etc.) ---
      if (session.apiKey) {
        headers['Authorization'] = `Bearer ${session.apiKey}`;
      }

      const messages = [
        { role: "system", content: session.systemInstruction },
        ...session.history.map(m => ({ 
          role: m.role === 'model' ? 'assistant' : 'user', 
          content: m.text 
        })),
        { role: "user", content: message }
      ];

      body = {
        messages,
        stream: false,
        temperature: 0.7
      };

      // Only include model if specifically provided by the admin
      if (session.modelName && session.modelName.trim().length > 0) {
        body.model = session.modelName;
      }

      // Automatically append /chat/completions if it's a base URL and not a direct file/param link
      let finalEndpoint = endpoint;
      if (!finalEndpoint.endsWith('/chat/completions') && !finalEndpoint.includes('?') && !finalEndpoint.includes(':')) {
        finalEndpoint = finalEndpoint.replace(/\/$/, '') + '/chat/completions';
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Provider Error ${response.status}: ${errData.substring(0, 150)}`);
    }

    const data = await response.json();

    // Support extraction from multiple formats
    if (isGoogleNative) {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
    } else {
      return data.choices?.[0]?.message?.content || data.content || data.response || "No response received.";
    }
  } catch (err: any) {
    throw new Error(`CONNECTION_ERROR: ${err.message}`);
  }
};
