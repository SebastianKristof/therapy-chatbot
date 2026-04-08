import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { Message as MessageType } from '../types';
import { cn } from '../lib/utils';
import type { SupportPrompt } from '../lib/supportPrompts';

interface MessageProps {
  message: MessageType;
  actionChips?: SupportPrompt[];
  onActionChipClick?: (prompt: SupportPrompt) => void;
}

export default function Message({ message, actionChips = [], onActionChipClick }: MessageProps) {
  const isAssistant = message.role === 'assistant';
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('idle');
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div className={cn("flex max-w-[85%] flex-col", isAssistant ? "items-start" : "items-end")}>
        <div 
          className={cn(
            "w-full p-4 rounded-3xl font-sans text-sm leading-relaxed shadow-sm relative",
            isAssistant 
              ? "bg-white/80 rounded-tl-none border border-border text-ink pr-12" 
              : "bg-accent text-white rounded-tr-none"
          )}
        >
          {isAssistant ? (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy reply"
              title="Copy reply"
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white/90 text-ink-muted transition-all hover:bg-white hover:text-ink"
            >
              {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          ) : null}
          <div className="markdown-body">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          <div className={cn(
            "text-[10px] mt-2 opacity-50",
            isAssistant ? "text-ink-muted" : "text-white/80"
          )}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {isAssistant && actionChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {actionChips.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => onActionChipClick?.(prompt)}
                className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs text-ink-muted transition-all hover:bg-white hover:text-ink"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
