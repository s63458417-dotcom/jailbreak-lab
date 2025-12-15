import { ChatMessage } from "../types";

// Unified Session Interface
export interface AISession {
  modelName: string;
  baseUrl: string;
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
  
  // 1. Resolve API Key
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    throw new Error("MISSING_API_KEY: No valid API key found. Please configure it in Admin settings or environment.");
  }

  // 2. Determine Provider Strategy
  // CRITICAL FIX: Explicitly check for googleapis.com to prevent "v1" or "beta" in the URL from triggering generic mode.
  const isGoogle = (baseUrl && baseUrl.includes('googleapis.com')) || (!baseUrl && modelName.toLowerCase().includes('gemini'));
  
  let isGenericEndpoint = false;
  if (!isGoogle && baseUrl) {
      isGenericEndpoint = (
        baseUrl.includes('huggingface') || 
        baseUrl.includes('deepseek') || 
        baseUrl.includes('openai') || 
        baseUrl.includes('v1') || // Only trigger v1 if NOT google
        !modelName.toLowerCase().includes('gemini')
      );
  }

  // 3. Return session object
  return {
    modelName,
    baseUrl: baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
    apiKey,
    systemInstruction,
    history: [...history], 
    isGeneric: isGenericEndpoint
  };
};

export const sendMessageToGemini = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  // --- PATH A: GENERIC OPENAI-COMPATIBLE (HuggingFace/DeepSeek/OpenAI) ---
  if (session.isGeneric) {
      try {
        const messages = [
            { role: "system", content: session.systemInstruction },
            ...session.history.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.text
            })),
            { role: "user", content: message }
        ];

        const payload = {
            model: session.modelName,
            messages: messages,
            stream: false
        };

        // Normalize Endpoint for Generic Providers
        let endpoint = session.baseUrl;
        // Only append chat/completions if the user didn't provide a full endpoint
        if (!endpoint.endsWith('/chat/completions') && !endpoint.endsWith('/generate') && !endpoint.includes('/v1/chat')) {
             // Basic heuristic: if it ends in /v1, add /chat/completions, otherwise just add /chat/completions
             endpoint = endpoint.replace(/\/$/, ''); 
             if (endpoint.endsWith('/v1')) {
                 endpoint += '/chat/completions';
             } else {
                 endpoint += '/chat/completions';
             }
        }
        
        let authHeader = '';
        const cleanKey = session.apiKey.trim();
        if (cleanKey.toLowerCase().startsWith('basic ') || cleanKey.toLowerCase().startsWith('bearer ')) {
            authHeader = cleanKey;
        } else {
            authHeader = `Bearer ${cleanKey}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
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

        session.history.push({ id: Date.now().toString(), role: 'user', text: message, timestamp: Date.now() });
        session.history.push({ id: (Date.now()+1).toString(), role: 'model', text: reply, timestamp: Date.now() });

        return reply;

      } catch (error: any) {
          console.error("Custom Endpoint Error:", error);
          throw new Error(`UPLINK FAILED: ${error.message}`);
      }
  }

  // --- PATH B: GOOGLE GEMINI REST API (Direct Fetch) ---
  try {
      let endpoint = session.baseUrl;

      // URL Construction Logic
      // If the user provided a full URL (containing :generateContent), use it as is.
      // Otherwise, assume it's a base URL and construct the path.
      if (!endpoint.includes(':generateContent')) {
           const cleanBase = endpoint.replace(/\/+$/, '');
           endpoint = `${cleanBase}/models/${session.modelName}:generateContent`;
      }

      // Append API Key
      // Handle cases where query params might already exist
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint = `${endpoint}${separator}key=${session.apiKey}`;

      const contents = session.history
          .filter(msg => msg.role === 'user' || msg.role === 'model')
          .map(msg => ({
              role: msg.role,
              parts: [{ text: msg.text }]
          }));
      
      contents.push({
          role: 'user',
          parts: [{ text: message }]
      });

      const payload = {
          contents: contents,
          systemInstruction: {
              parts: [{ text: session.systemInstruction }]
          },
          generationConfig: {
              temperature: 0.9, 
          }
      };

      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errText = await response.text();
          if (response.status === 403) throw new Error("ACCESS_DENIED: API Key invalid or quota exceeded.");
          if (response.status === 404) throw new Error("404 NOT FOUND: Check model name or endpoint URL.");
          throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
          if (data.promptFeedback?.blockReason) {
              throw new Error(`BLOCKED: ${data.promptFeedback.blockReason}`);
          }
          throw new Error("Empty response from Gemini.");
      }

      session.history.push({ id: Date.now().toString(), role: 'user', text: message, timestamp: Date.now() });
      session.history.push({ id: (Date.now()+1).toString(), role: 'model', text: reply, timestamp: Date.now() });

      return reply;

  } catch (error: any) {
      console.error("Gemini Direct API Error:", error);
      // Improve error message for fetch failures (CORS/Network)
      if (error.message === 'Failed to fetch') {
          throw new Error("CONNECTION FAILED: Check your network or URL. (Note: Ensure the endpoint supports CORS if running in browser)");
      }
      throw new Error(`UPLINK FAILED: ${error.message}`);
  }
};
