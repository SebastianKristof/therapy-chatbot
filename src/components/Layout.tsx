import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn("min-h-screen bg-bg flex flex-col", className)}>
      <header className="p-6 flex justify-between items-center border-b border-border bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo-mark.svg" alt="AskDrKristof" className="w-9 h-9 shrink-0" />
          <h1 className="text-xl font-serif font-semibold tracking-tight">AskDrKristof</h1>
        </div>
        <div className="text-xs font-sans text-ink-muted uppercase tracking-widest">
          Private AI Companion
        </div>
      </header>
      
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>
      
      <footer className="p-6 text-center text-[10px] text-ink-muted uppercase tracking-widest border-t border-border bg-white/30">
        &copy; {new Date().getFullYear()} AskDrKristof &bull; Not for Crisis Support
      </footer>
    </div>
  );
}
