
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
  // Use custom URL or fallback to an empty string to force error if not set
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
  if (!session) throw new Error("INTERNAL_SESSION_NULL");
  if (!session.baseUrl) throw new Error("NO_ENDPOINT_DEFINED: Please configure the Base URL for this persona in the Admin Console.");
  if (!session.apiKey) throw new Error("NO_AUTH_TOKEN: An API key is required to connect to this uplink.");

  let endpoint = session.baseUrl;
  // Standard chat completions path normalization
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
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
        const raw = await response.text();
        throw new Error(`Uplink Error ${response.status}: ${raw.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (typeof content !== 'string') {
        throw new Error("MALFORMED_RESPONSE: The remote provider returned an invalid payload structure.");
    }

    return content;
  } catch (err: any) {
    throw new Error(`CONNECTION_FAILED: ${err.message}`);
  }
};
