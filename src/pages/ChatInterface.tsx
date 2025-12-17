
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToAI, AISession } from '../services/aiService';
import { marked } from 'marked';

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    if (!content) return '';
    const renderer = new marked.Renderer();
    renderer.code = (code: string, language: string | undefined) => {
      const validLang = language || 'text';
      const encodedRaw = encodeURIComponent(code);
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="not-prose my-4 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 group">
          <div class="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-800">
            <span class="text-xs font-mono font-bold text-neutral-400 lowercase">${validLang}</span>
            <button class="copy-btn flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-all px-2 py-1 rounded" data-code="${encodedRaw}">
              <span>Copy</span>
            </button>
          </div>
          <div class="p-4 overflow-x-auto custom-scrollbar bg-neutral-900">
             <pre class="m-0 p-0 bg-transparent text-sm font-mono leading-relaxed text-neutral-200"><code class="language-${validLang}">${escapedCode}</code></pre>
          </div>
        </div>
      `;
    };
    return marked.parse(content, { renderer }) as string;
  }, [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleCopy = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.copy-btn');
      if (!target) return;
      const btn = target as HTMLButtonElement;
      const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
      try {
        await navigator.clipboard.writeText(rawCode);
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-green-400">Copied</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
      } catch (err) {}
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:text-neutral-300" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatInterface: React.FC<{ personaId: string }> = ({ personaId }) => {
  const { personas, getChatHistory, saveChatMessage, clearChatHistory, getValidKey } = useStore();
  const { user, isAdmin } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [chatSession, setChatSession] = useState<AISession | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [personaId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    if (!user || !persona) return;
    setConfirmClear(false);
    const history = getChatHistory(user.id, personaId);
    setMessages(history);
    let mounted = true;
    setIsConnecting(true);

    const initAI = async () => {
      try {
        let selectedKey = persona.customApiKey;
        if (persona.keyPoolId) {
             const vaultKey = getValidKey(persona.keyPoolId);
             if (vaultKey) selectedKey = vaultKey;
        }
        const session = await createChatSession(persona.model, persona.systemPrompt, history, persona.baseUrl, selectedKey);
        if (mounted) {
            setChatSession(session);
            setIsConnecting(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
      } catch (e: any) {
        if (mounted) {
            setIsConnecting(false);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `**LINK FAILURE:** ${e.message}`, timestamp: Date.now() }]);
        }
      }
    };
    initAI();
    return () => { mounted = false; };
  }, [personaId, user, getChatHistory]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user || !chatSession) return;
    const textPayload = inputValue.trim();
    setInputValue('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textPayload, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    saveChatMessage(user.id, persona.id, userMsg);
    setIsSending(true);
    try {
      const responseText = await sendMessageToAI(chatSession, textPayload);
      const modelMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);
      saveChatMessage(user.id, persona.id, modelMsg);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: `**ERROR:** ${error.message}`, timestamp: Date.now() }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div>INVALID_TARGET</div></Layout>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-neutral-950">
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-neutral-800 bg-neutral-900">
          <span className="text-sm font-bold text-white">{persona.name}</span>
          <button onClick={() => { if(confirmClear) { clearChatHistory(user!.id, personaId); setMessages([]); } else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); } }} className="text-xs text-neutral-500 hover:text-white">{confirmClear ? "CONFIRM" : "Clear History"}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-5 rounded-2xl ${m.role === 'user' ? 'bg-neutral-800 border border-neutral-700 text-white' : 'bg-transparent text-neutral-200 pl-0'}`}>
                  {m.role === 'model' && <div className="text-xs font-bold text-brand-500 mb-2 uppercase tracking-widest">{persona.name}</div>}
                  <MessageContent content={m.text} />
                </div>
              </div>
            ))}
            {isSending && <div className="text-xs text-neutral-500 animate-pulse font-mono uppercase tracking-widest pl-2">Processing Response...</div>}
          </div>
        </div>
        
        {/* Input Area - Restored visible Send Button */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950">
          <div className="max-w-4xl mx-auto flex items-center gap-2 relative">
              <input 
                ref={inputRef}
                className="w-full bg-neutral-900 border border-neutral-800 text-white pl-5 pr-14 py-4 rounded-xl focus:border-brand-600 outline-none transition-all placeholder:text-neutral-600"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                disabled={isSending || isConnecting}
              />
              <button 
                onClick={handleSend}
                disabled={isSending || isConnecting || !inputValue.trim()}
                className="absolute right-2 top-2 bottom-2 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-lg transition-colors flex items-center justify-center"
              >
                {isSending ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
