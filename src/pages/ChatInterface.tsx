
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
        <div class="not-prose my-6 rounded-2xl overflow-hidden border border-[#262626] bg-[#171717] shadow-xl">
          <div class="flex items-center justify-between px-4 py-3 bg-[#262626] border-b border-[#333]">
            <span class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">${validLang}</span>
            <button class="copy-btn flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-all px-3 py-1.5 rounded-lg hover:bg-white/5 active:scale-95" data-code="${encodedRaw}">
              <span>Copy Code</span>
            </button>
          </div>
          <div class="p-5 overflow-x-auto custom-scrollbar bg-[#0d0d0d]">
             <pre class="m-0 p-0 bg-transparent text-sm font-mono leading-relaxed text-blue-100/90"><code class="language-${validLang}">${escapedCode}</code></pre>
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
        btn.innerHTML = `<span class="text-green-400">Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
      } catch (err) {}
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:text-[#ececec] prose-p:leading-relaxed prose-p:mb-5 prose-headings:text-white prose-headings:font-bold prose-strong:text-brand-400" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatInterface: React.FC<{ personaId: string }> = ({ personaId }) => {
  const { personas, getChatHistory, saveChatMessage, clearChatHistory, getValidKey, config } = useStore();
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
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (!user || !persona) return;
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
  }, [personaId, user]);

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

  const handleNewChat = () => {
    if (user && persona) {
      clearChatHistory(user.id, persona.id);
      setMessages([]);
      window.location.reload(); // Force session reset
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center font-mono">TARGET_UPLINK_NOT_FOUND</div></Layout>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#0d0d0d] relative">
        
        {/* DeepSeek Style Header */}
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 bg-[#171717] border-b border-[#262626] z-30">
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="text-white font-bold text-xs">{persona.name.charAt(0)}</span>
                 </div>
                 <h1 className="text-sm font-bold text-white tracking-wide">{persona.name}</h1>
             </div>
             <div className="flex items-center gap-3">
                 <button onClick={handleNewChat} className="p-2 text-neutral-400 hover:text-white transition-colors" title="Clear History">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                 </button>
             </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
          {messages.length === 0 ? (
            /* Centered Landing View - Exactly like the Screenshot */
            <div className="h-full flex flex-col items-center justify-center px-6 animate-in fade-in duration-1000">
                <div className="w-16 h-16 rounded-3xl bg-brand-600 flex items-center justify-center mb-8 shadow-2xl shadow-brand-900/40 transform transition-transform hover:scale-105">
                   {persona.avatarUrl ? <img src={persona.avatarUrl} className="w-full h-full object-cover rounded-3xl" /> : <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Hi, I'm {persona.name}.</h2>
                <p className="text-neutral-500 text-lg font-medium text-center max-w-md">
                    {persona.description || "How can I help you today?"}
                </p>
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                    <span className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-xs text-neutral-400 font-mono">MODEL: {persona.model}</span>
                    <span className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-xs text-neutral-400 font-mono uppercase tracking-widest">Uplink Secured</span>
                </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-10 px-6 space-y-10">
                {messages.map((m) => (
                  <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative ${m.role === 'user' ? 'max-w-[85%] bg-[#2b2b2b] text-white px-5 py-3 rounded-[1.25rem] rounded-tr-none border border-white/5' : 'w-full'}`}>
                      {m.role === 'model' && (
                        <div className="flex items-center gap-2 mb-4">
                           <div className="w-6 h-6 rounded-md bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 text-[10px] font-bold shadow-sm">AI</div>
                           <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{persona.name}</span>
                        </div>
                      )}
                      <MessageContent content={m.text} />
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex w-full justify-start animate-pulse">
                     <div className="w-full">
                        <div className="flex items-center gap-2 mb-4">
                           <div className="w-6 h-6 rounded-md bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 text-[10px] font-bold">AI</div>
                           <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Generating Intelligence...</span>
                        </div>
                        <div className="h-4 w-1/2 bg-white/5 rounded-full mb-2"></div>
                        <div className="h-4 w-1/3 bg-white/5 rounded-full"></div>
                     </div>
                  </div>
                )}
                <div className="h-10" />
            </div>
          )}
        </div>

        {/* Floating Rounded Input Center */}
        <div className="px-4 pb-8 pt-2 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent">
            <div className="max-w-3xl mx-auto">
                {/* Behavior Pills - Exactly like the Screenshot */}
                <div className="flex items-center gap-2 mb-3 px-1">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171717] border border-[#262626] hover:bg-[#262626] text-[11px] font-bold text-neutral-300 transition-all active:scale-95 group">
                        <svg className="w-4 h-4 text-brand-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        DeepThink
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171717] border border-[#262626] hover:bg-[#262626] text-[11px] font-bold text-neutral-300 transition-all active:scale-95 group">
                        <svg className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                        Search
                    </button>
                </div>

                {/* Input Area */}
                <div className="relative bg-[#171717] border border-[#262626] rounded-3xl p-1.5 shadow-2xl focus-within:border-brand-600/50 transition-all duration-300 group">
                    <textarea 
                        ref={inputRef}
                        rows={1}
                        className="w-full bg-transparent text-white pl-4 pr-16 py-3 outline-none resize-none text-base placeholder:text-neutral-600 custom-scrollbar max-h-48"
                        placeholder={`Message ${persona.name}...`}
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={isSending || isConnecting}
                    />
                    
                    {/* Floating Send Button - Circular Blue style */}
                    <button 
                        onClick={handleSend}
                        disabled={isSending || isConnecting || !inputValue.trim()}
                        className={`absolute right-2.5 bottom-2.5 w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-lg active:scale-90 ${
                            inputValue.trim() 
                            ? 'bg-brand-600 hover:bg-brand-500 text-white' 
                            : 'bg-[#262626] text-neutral-600'
                        }`}
                    >
                        {isSending ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        )}
                    </button>
                    
                    {/* Add attachment/plus button logic if needed */}
                    <button className="absolute left-3 bottom-3 p-1.5 text-neutral-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <div className="absolute left-10 bottom-3.5 w-[1px] h-4 bg-white/5 ml-2"></div>
                </div>
                
                <p className="mt-3 text-center text-[10px] text-neutral-700 font-mono tracking-widest uppercase opacity-40">
                    {config.appName} // {config.creatorName}
                </p>
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
