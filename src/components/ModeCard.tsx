import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { Mode } from '../types';
import { cn } from '../lib/utils';

interface ModeCardProps {
  mode: {
    id: Mode;
    title: string;
    description: string;
    icon: LucideIcon;
  };
  index: number;
  onClick: () => void;
}

export default function ModeCard({ mode, index, onClick }: ModeCardProps) {
  const Icon = mode.icon;
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-start text-left p-6 rounded-3xl bg-white/60 border border-border shadow-sm transition-all group"
    >
      <div className="w-12 h-12 rounded-2xl bg-accent-light flex items-center justify-center text-accent mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
        <Icon size={24} />
      </div>
      
      <h3 className="text-xl font-serif font-semibold text-ink mb-2 leading-tight">
        {mode.title}
      </h3>
      
      <p className="text-sm text-ink-muted leading-relaxed font-sans">
        {mode.description}
      </p>
    </motion.button>
  );
}
