import { ChatMessage } from "../types";

// Unified Session Interface (No SDK types)
export interface AISession {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[]; // We keep the full message history objects
  isGeneric: boolean; // true = OpenAI/DeepSeek format, false = Google format
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
  const isGenericEndpoint = baseUrl && (
    baseUrl.includes('huggingface') || 
    baseUrl.includes('deepseek') || 
    baseUrl.includes('openai') || 
    baseUrl.includes('v1') ||
    !modelName.toLowerCase().includes('gemini') 
  );

  // 3. Return a session object (stateless config holder)
  return {
    modelName,
    baseUrl: baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
    apiKey,
    systemInstruction,
    history: [...history], // Clone history
    isGeneric: !!isGenericEndpoint
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
        // Construct OpenAI-compatible messages array
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

        // Normalize Endpoint
        let endpoint = session.baseUrl;
        if (!endpoint.endsWith('/chat/completions') && !endpoint.endsWith('/generate')) {
            endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
        }
        
        // Auth Header Logic
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

        // Update local session history (optional, as main UI handles persistence)
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
      // 1. Construct Google Endpoint
      const endpoint = `${session.baseUrl}/models/${session.modelName}:generateContent?key=${session.apiKey}`;

      // 2. Format History for Gemini (role: 'user' | 'model', parts: [{text: ...}])
      const contents = session.history
          .filter(msg => msg.role === 'user' || msg.role === 'model')
          .map(msg => ({
              role: msg.role,
              parts: [{ text: msg.text }]
          }));
      
      // Add current message
      contents.push({
          role: 'user',
          parts: [{ text: message }]
      });

      // 3. Payload
      const payload = {
          contents: contents,
          systemInstruction: {
              parts: [{ text: session.systemInstruction }]
          },
          generationConfig: {
              // Optional: Add default generation config here if needed
              temperature: 0.9, 
          }
      };

      // 4. Execute Fetch
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
          throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      
      // 5. Extract Text
      // Response structure: candidates[0].content.parts[0].text
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
          // Check for safety blocks
          if (data.promptFeedback?.blockReason) {
              throw new Error(`BLOCKED: ${data.promptFeedback.blockReason}`);
          }
          throw new Error("Empty response from Gemini.");
      }

      // Update session history
      session.history.push({ id: Date.now().toString(), role: 'user', text: message, timestamp: Date.now() });
      session.history.push({ id: (Date.now()+1).toString(), role: 'model', text: reply, timestamp: Date.now() });

      return reply;

  } catch (error: any) {
      console.error("Gemini Direct API Error:", error);
      throw new Error(`UPLINK FAILED: ${error.message}`);
  }
};
