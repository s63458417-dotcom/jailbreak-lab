
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
        <div class="not-prose my-4 rounded-lg overflow-hidden border border-[#2e2e2e] bg-[#0d0d0d] group">
          <div class="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#2e2e2e]">
            <span class="text-xs font-mono font-bold text-neutral-400 lowercase">${validLang}</span>
            <button class="copy-btn flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-all px-2 py-1 rounded" data-code="${encodedRaw}">
              <span>Copy</span>
            </button>
          </div>
          <div class="p-4 overflow-x-auto custom-scrollbar bg-[#0d0d0d]">
             <pre class="m-0 p-0 bg-transparent text-sm font-mono leading-relaxed text-[#e0e0e0]"><code class="language-${validLang}">${escapedCode}</code></pre>
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
  const { personas, getChatHistory, saveChatMessage, clearChatHistory, getValidKey, reportKeyFailure, getUsageCount, incrementUsage } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [chatSession, setChatSession] = useState<AISession | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setTimeout(() => textareaRef.current?.focus(), 100);
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
            setTimeout(() => textareaRef.current?.focus(), 100);
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
  }, [personaId, user, getChatHistory, retryTrigger]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user || !chatSession) return;
    const textPayload = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: error.message || "Connection lost.", timestamp: Date.now() }]);
    } finally {
      setIsSending(false);
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div>INVALID_TARGET</div></Layout>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#212121]">
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-[#2e2e2e]">
          <span className="text-sm font-bold text-white">{persona.name}</span>
          <button onClick={() => { if(confirmClear) { clearChatHistory(user!.id, personaId); setMessages([]); setRetryTrigger(t => t+1); } else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); } }} className="text-xs text-neutral-500 hover:text-white">{confirmClear ? "CONFIRM" : "Clear"}</button>
        </div>
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-xl ${m.role === 'user' ? 'bg-[#2f2f2f] border border-[#3a3a3a]' : ''}`}>
                  <MessageContent content={m.text} />
                </div>
              </div>
            ))}
            {isSending && <div className="text-xs text-neutral-500 animate-pulse">Thinking...</div>}
          </div>
        </div>
        <div className="p-4 border-t border-[#2e2e2e]">
          <textarea ref={textareaRef} className="w-full bg-[#2f2f2f] text-white p-3 rounded-xl outline-none resize-none" rows={1} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Message..." disabled={isSending || isConnecting} />
        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
