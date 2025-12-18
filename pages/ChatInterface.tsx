
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToAI, AISession } from '../aiService';
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
        <div class="not-prose my-6 rounded-2xl overflow-hidden border border-[#262626] bg-[#171717] shadow-xl">
          <div class="flex items-center justify-between px-4 py-3 bg-[#262626] border-b border-[#333]">
            <span class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">${validLang}</span>
            <button class="copy-btn flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all" data-code="${encodedRaw}">
              Copy
            </button>
          </div>
          <div class="p-5 overflow-x-auto custom-scrollbar bg-[#0d0d0d]">
             <pre class="m-0 p-0 text-sm font-mono leading-relaxed text-blue-100/90"><code class="language-${validLang}">${escapedCode}</code></pre>
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
      await navigator.clipboard.writeText(rawCode);
      const original = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => { btn.innerText = original; }, 2000);
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:m-0" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatInterface: React.FC<{ personaId: string }> = ({ personaId }) => {
  const { personas, getChatHistory, saveChatMessage, clearChatHistory, getValidKey } = useStore();
  const { user } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [chatSession, setChatSession] = useState<AISession | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    if (!user || !persona) return;
    const history = getChatHistory(user.id, personaId);
    setMessages(history);
    setIsConnecting(true);

    const initAI = async () => {
      try {
        let key = persona.customApiKey;
        if (persona.keyPoolId) key = getValidKey(persona.keyPoolId) || key;
        const session = await createChatSession(persona.model, persona.systemPrompt, history, persona.baseUrl, key);
        setChatSession(session);
        setIsConnecting(false);
      } catch (e: any) {
        setIsConnecting(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `System Failure: ${e.message}`, timestamp: Date.now() }]);
      }
    };
    initAI();
  }, [personaId, user]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user || !chatSession) return;
    const text = inputValue.trim();
    setInputValue('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    saveChatMessage(user.id, persona.id, userMsg);
    setIsSending(true);
    try {
      const reply = await sendMessageToAI(chatSession, text);
      const modelMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: reply, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);
      saveChatMessage(user.id, persona.id, modelMsg);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Error: ${e.message}`, timestamp: Date.now() }]);
    } finally { setIsSending(false); }
  };

  if (!persona) return <div>Persona Not Found</div>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#0d0d0d] relative overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-[#1a1a1a] bg-[#0d0d0d] z-20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
                {persona.name.charAt(0)}
             </div>
             <span className="font-bold text-sm text-white">{persona.name}</span>
          </div>
          <button onClick={() => { if(confirm("Reset chat history?")) { clearChatHistory(user!.id, persona.id); setMessages([]); } }} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>

        {/* Message View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-40" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in text-center">
                <div className="w-20 h-20 rounded-[2.5rem] bg-brand-600 flex items-center justify-center mb-8 shadow-2xl shadow-brand-900/40 transform transition-transform hover:scale-105">
                  {persona.avatarUrl ? <img src={persona.avatarUrl} className="w-full h-full object-cover rounded-[2.5rem]" /> : <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Hi, I'm {persona.name}.</h2>
                <p className="text-neutral-500 text-lg font-medium max-w-md">{persona.description || "How can I help you today?"}</p>
                <div className="mt-8 flex gap-3">
                   <div className="px-4 py-2 bg-[#171717] border border-[#262626] rounded-full text-xs text-neutral-400 font-mono">MODEL: {persona.model}</div>
                   <div className="px-4 py-2 bg-[#171717] border border-[#262626] rounded-full text-xs text-neutral-400 font-mono uppercase tracking-widest">Secured Uplink</div>
                </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-10">
              {messages.map(m => (
                <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative ${m.role === 'user' ? 'max-w-[85%] bg-[#212121] text-white px-5 py-3 rounded-2xl rounded-tr-none border border-[#2e2e2e]' : 'w-full'}`}>
                    {m.role === 'model' && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-md bg-brand-600/20 flex items-center justify-center text-brand-400 text-[10px] font-bold shadow-sm">AI</div>
                        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{persona.name}</span>
                      </div>
                    )}
                    <MessageContent content={m.text} />
                  </div>
                </div>
              ))}
              {isSending && <div className="animate-pulse flex items-center gap-2 text-xs text-neutral-500 font-bold uppercase tracking-widest">Generating Intelligence...</div>}
            </div>
          )}
        </div>

        {/* Floating Footer Input */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            {/* Action Pills */}
            <div className="flex gap-2 mb-3 px-1">
              <button className="px-3 py-1.5 rounded-xl bg-[#171717] border border-[#262626] text-[11px] font-bold text-neutral-400 hover:text-white transition-all flex items-center gap-2 group">
                <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                DeepThink
              </button>
              <button className="px-3 py-1.5 rounded-xl bg-[#171717] border border-[#262626] text-[11px] font-bold text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                 <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Search
              </button>
            </div>
            {/* Input Bar */}
            <div className="relative bg-[#171717] border border-[#262626] rounded-3xl p-1.5 shadow-2xl focus-within:border-brand-600 transition-all group">
              <textarea 
                ref={inputRef} rows={1} value={inputValue} disabled={isSending}
                onChange={(e) => { setInputValue(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="w-full bg-transparent text-white pl-4 pr-14 py-3 outline-none resize-none text-base placeholder:text-neutral-600 custom-scrollbar max-h-40"
                placeholder={`Message ${persona.name}...`}
              />
              <button onClick={handleSend} disabled={!inputValue.trim() || isSending} className={`absolute right-2.5 bottom-2.5 w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${inputValue.trim() ? 'bg-brand-600 text-white' : 'bg-[#262626] text-neutral-600'}`}>
                {isSending ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
