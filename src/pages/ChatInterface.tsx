
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToGemini } from '../services/geminiService';
import { marked } from 'marked';

interface ChatInterfaceProps {
    personaId: string;
}

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    try {
        const renderer = new marked.Renderer();
        
        renderer.code = (code, language) => {
          const lang = language || 'text';
          const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const encodedRaw = encodeURIComponent(code);
          return `
            <div class="code-block-wrapper relative group my-4 rounded-lg overflow-hidden border border-[#404040] bg-[#1e1e1e]">
              <div class="flex items-center justify-between px-3 py-1.5 bg-[#252525] border-b border-[#404040]">
                <span class="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">${lang}</span>
                <button class="copy-btn flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-white transition-colors" data-code="${encodedRaw}">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span>Copy</span>
                </button>
              </div>
              <pre class="p-3 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed text-[#d4d4d4] bg-transparent m-0"><code class="language-${lang}">${escapedCode}</code></pre>
            </div>
          `;
        };
        return marked.parse(content, { renderer });
    } catch (e) {
        console.error("Markdown parsing failed", e);
        return content; 
    }
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
        btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg><span class="text-green-400">Copied</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
      } catch (err) { console.error('Failed to copy', err); }
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  // Removed prose-code:text-brand-200 and prose-a:text-brand-400 to fix "blue text" issue
  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:mb-2 prose-headings:font-semibold prose-headings:text-neutral-100 prose-headings:mt-4 prose-headings:mb-2 prose-a:text-white prose-a:underline hover:prose-a:text-brand-300 prose-code:text-neutral-200 prose-code:font-mono prose-code:text-xs prose-code:bg-[#2a2a2a] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-strong:text-white prose-ul:list-disc prose-ul:pl-4 prose-ul:my-2 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:rounded-none" dangerouslySetInnerHTML={{ __html: htmlContent as string }} />;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ personaId }) => {
  const { personas, getValidKey, reportKeyFailure } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [personaId]);

  useEffect(() => {
    if (!persona || !user) return;
    if (persona.isLocked && !isAdmin) {
        const accessTime = getPersonaAccessTime(persona.id);
        if (!accessTime) {
             alert("ACCESS DENIED.");
             window.location.hash = '#/dashboard';
        }
    }
  }, [persona, user, isAdmin, getPersonaAccessTime]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  const getActiveKey = () => {
      if (persona?.keyPoolId) {
          const key = getValidKey(persona.keyPoolId);
          return { key, source: 'pool' };
      }
      return { key: persona?.customApiKey || undefined, source: 'legacy' };
  };

  const handleClearChat = () => {
      if (confirmClear) {
          setMessages([]);
          setConfirmClear(false);
      } else {
          setConfirmClear(true);
          setTimeout(() => setConfirmClear(false), 3000);
      }
  };

  const executeSend = async (text: string, attempt = 0): Promise<string> => {
      if (!persona) throw new Error("Persona lost");

      const { key, source } = getActiveKey();

      if (source === 'pool' && !key) {
          throw new Error("KEY VAULT DEPLETED: All tokens in this box are dead.");
      }

      try {
          const apiSession = await createChatSession(
              persona.model,
              persona.systemPrompt,
              messages, 
              persona.baseUrl,
              key 
          );

          return await sendMessageToGemini(apiSession, text);

      } catch (error: any) {
          const errMsg = error.message || '';
          const isAuthError = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('ACCESS_DENIED');
          const isQuotaError = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Too Many Requests') || errMsg.includes('QUOTA_EXCEEDED');

          if ((isAuthError || isQuotaError) && source === 'pool' && persona.keyPoolId && attempt < 5) {
              if (key) reportKeyFailure(persona.keyPoolId, key);
              return await executeSend(text, attempt + 1);
          }

          throw error;
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user) return;

    const textPayload = inputValue.trim();
    setInputValue('');
    setConfirmClear(false);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      const responseText = await executeSend(textPayload);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: error.message || "**SYSTEM ERROR:** Uplink unstable.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center text-red-500 font-mono">[ERROR]: TARGET INVALID</div></Layout>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#212121] relative w-full min-w-0">
            
            {/* Header - Minimalist DeepSeek Style */}
            <div className="flex-shrink-0 h-14 flex items-center justify-between px-4 lg:px-6 z-20">
                <div className="flex items-center gap-2">
                     <span className="text-neutral-400 text-sm">To:</span>
                     <div className="flex items-center gap-2 bg-[#2f2f2f] px-2 py-1 rounded text-sm text-white">
                        {persona.name} 
                        <span className="text-neutral-500 text-xs">({persona.model})</span>
                     </div>
                </div>

                <button 
                    onClick={handleClearChat}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                        confirmClear ? 'bg-red-500/20 text-red-400' : 'text-neutral-400 hover:bg-[#2f2f2f] hover:text-white'
                    }`}
                >
                     {confirmClear ? "Confirm Wipe" : "Clear Context"}
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth" ref={scrollRef}>
                <div className="max-w-3xl mx-auto py-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40 select-none">
                            <div className="w-16 h-16 rounded-full bg-[#2f2f2f] flex items-center justify-center mb-4">
                                {persona.avatarUrl ? <img src={persona.avatarUrl} className="w-8 h-8 opacity-50 grayscale" /> : <svg className="w-8 h-8 text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>}
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">How can I help you?</h3>
                        </div>
                    )}
                    
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <div className="max-w-[85%] bg-[#2f2f2f] text-[#ececec] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
                                    <MessageContent content={msg.text} />
                                </div>
                            ) : (
                                <div className="flex gap-4 max-w-full w-full">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2b2b2b] border border-[#404040] flex items-center justify-center text-xs font-bold text-brand-500 mt-0.5">
                                        AI
                                    </div>
                                    <div className="flex-1 min-w-0 text-[#d4d4d4] text-[15px] leading-relaxed pt-1">
                                        <MessageContent content={msg.text} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {isSending && (
                        <div className="flex gap-4 w-full">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2b2b2b] border border-[#404040] flex items-center justify-center mt-0.5">
                                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
                            </div>
                            <div className="flex-1 pt-2">
                                <span className="text-neutral-400 text-sm animate-pulse">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Input Area - DeepSeek Style */}
            <div className="flex-shrink-0 p-4 md:pb-6 z-20">
                <div className="max-w-3xl mx-auto bg-[#2f2f2f] rounded-2xl p-3 relative shadow-lg border border-[#404040]/50">
                    <textarea
                        ref={inputRef}
                        className="w-full bg-transparent text-white text-sm px-2 py-1 outline-none resize-none max-h-32 min-h-[44px] custom-scrollbar placeholder:text-neutral-500"
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
                        placeholder="Message..."
                        disabled={isSending}
                        rows={1}
                    />
                    
                    <div className="flex justify-between items-center mt-2 px-1">
                        {/* LEFT: Removed Attachment/File Icon as requested */}
                        <div className="flex items-center gap-2">
                        </div>
                        
                        {/* RIGHT: Send Button */}
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isSending}
                                className={`p-2 rounded-full transition-all ${
                                    inputValue.trim() && !isSending 
                                    ? 'bg-white text-black hover:bg-neutral-200' 
                                    : 'bg-[#404040] text-neutral-500 cursor-not-allowed'
                                }`}
                             >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                             </button>
                        </div>
                    </div>
                </div>
                <p className="text-center text-[10px] text-neutral-600 mt-2">AI-generated content may be inaccurate.</p>
            </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
