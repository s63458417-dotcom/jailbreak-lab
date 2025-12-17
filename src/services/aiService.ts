
import { ChatMessage } from "../types";

export interface AISession {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
}

/**
 * Creates a session object for a specific AI persona.
 * Every persona now requires a baseUrl and apiKey (either direct or from a vault).
 */
export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  // Use custom URL or fallback to a blank string if not set
  const finalBaseUrl = baseUrl || '';
  const finalApiKey = customApiKey || '';

  return {
    modelName,
    baseUrl: finalBaseUrl,
    apiKey: finalApiKey,
    systemInstruction,
    history: [...history]
  };
};

/**
 * Sends a message using a standard OpenAI-compatible fetch request.
 * No SDKs used. No hidden initialization.
 */
export const sendMessageToAI = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) throw new Error("SESSION_UNDEFINED");
  if (!session.baseUrl) throw new Error("MISSING_ENDPOINT_URL: Please set a Base URL for this persona in Admin.");
  if (!session.apiKey) throw new Error("MISSING_AUTH_KEY: No API key provided for this uplink.");

  let endpoint = session.baseUrl;
  // Ensure endpoint hits the completions route
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
        temperature: 0.7
      })
    });

    if (!response.ok) {
        const raw = await response.text();
        throw new Error(`Uplink Error (${response.status}): ${raw.substring(0, 150)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
        throw new Error("EMPTY_PAYLOAD: The remote provider returned no text content.");
    }

    return content;
  } catch (err: any) {
    throw new Error(`CONNECTION_FAILED: ${err.message}`);
  }
};
