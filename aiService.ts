
import { ChatMessage } from "./types";

export interface AISession {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
}

/**
 * Creates a generic session for OpenAI-compatible endpoints.
 * NO GOOGLE SDK USED.
 */
export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  return {
    modelName,
    baseUrl: baseUrl || '',
    apiKey: customApiKey || '',
    systemInstruction,
    history: [...history]
  };
};

/**
 * Sends a message using a standard REST API fetch call.
 */
export const sendMessageToAI = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session.baseUrl) throw new Error("MISSING_ENDPOINT: No Base URL defined for this uplink.");
  if (!session.apiKey) throw new Error("MISSING_AUTH: No API Key provided for this uplink.");

  let endpoint = session.baseUrl;
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
          ...session.history.map(m => ({ 
            role: m.role === 'model' ? 'assistant' : 'user', 
            content: m.text 
          })),
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Provider Error ${response.status}: ${errData.substring(0, 100)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response received.";
  } catch (err: any) {
    throw new Error(`UPLINK_FAILURE: ${err.message}`);
  }
};
