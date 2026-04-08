import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Message as MessageType, Mode } from '../types';
import { MODES } from '../constants';
import { generateResponse, generateSummary } from '../services/aiGatewayService';
import Message from './Message';
import Summary from './Summary';

interface ChatScreenProps {
  mode: Mode;
  onBack: () => void;
}

export default function ChatScreen({ mode, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const modeConfig = MODES.find(m => m.id === mode);
  
  useEffect(() => {
    if (mode !== 'chat' && modeConfig) {
      // Initial message from assistant
      const initialMessage: MessageType = {
        id: 'initial',
        role: 'assistant',
        content: `I'm here to help you ${modeConfig.title.toLowerCase()}. ${modeConfig.description}`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }
  }, [mode, modeConfig]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const response = await generateResponse(mode, messages, input);
    
    const assistantMessage: MessageType = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleEndSession = async () => {
    setIsEnding(true);
    const sessionSummary = await generateSummary(messages);
    setSummary(sessionSummary);
  };

  if (summary) {
    return <Summary summary={summary} onDone={onBack} />;
  }

  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-[calc(100vh-180px)]"
    >
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn-ghost flex items-center gap-2 -ml-4">
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center">
          <h3 className="text-lg font-serif font-semibold">{modeConfig?.title || "Chat"}</h3>
          <p className="text-[10px] text-ink-muted uppercase tracking-widest">Guided Support</p>
        </div>
        <button onClick={handleEndSession} className="btn-ghost text-sm text-accent font-medium">
          End Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-8 scrollbar-hide">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/60 p-4 rounded-3xl rounded-tl-none border border-border animate-pulse">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="relative pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reflection here..."
          className="w-full bg-white/80 border border-border rounded-full px-6 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-sans text-ink"
        />
        <button 
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-2 top-[calc(50%+8px)] -translate-y-1/2 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-all"
        >
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}
