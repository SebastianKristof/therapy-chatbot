import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Share2, Download } from 'lucide-react';

interface SummaryProps {
  summary: string;
  onDone: () => void;
}

export default function Summary({ summary, onDone }: SummaryProps) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center py-8 space-y-8"
    >
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
        <CheckCircle2 size={32} />
      </div>
      
      <div className="space-y-4 max-w-md">
        <h2 className="text-3xl font-serif font-semibold text-ink">Session Complete</h2>
        <p className="text-lg text-ink-muted font-sans">
          Here is a summary of our interaction to carry with you.
        </p>
      </div>
      
      <div className="w-full bg-white/60 border border-border rounded-3xl p-8 text-left shadow-sm">
        <div className="markdown-body">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      </div>
      
      <div className="flex flex-col gap-4 w-full max-w-xs pt-4">
        <button onClick={onDone} className="btn-primary w-full">
          Return Home
        </button>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs">
            <Share2 size={14} /> Share
          </button>
          <button className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs">
            <Download size={14} /> Save
          </button>
        </div>
      </div>
    </motion.div>
  );
}
