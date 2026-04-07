import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { Message as MessageType } from '../types';
import { cn } from '../lib/utils';

interface MessageProps {
  message: MessageType;
}

export default function Message({ message }: MessageProps) {
  const isAssistant = message.role === 'assistant';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div 
        className={cn(
          "max-w-[85%] p-4 rounded-3xl font-sans text-sm leading-relaxed shadow-sm",
          isAssistant 
            ? "bg-white/80 rounded-tl-none border border-border text-ink" 
            : "bg-accent text-white rounded-tr-none"
        )}
      >
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
    </motion.div>
  );
}
