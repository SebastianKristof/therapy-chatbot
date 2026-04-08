import React from 'react';
import { AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  chromeVisible?: boolean;
  lockViewport?: boolean;
}

export default function Layout({
  children,
  className,
  chromeVisible = true,
  lockViewport = true,
}: LayoutProps) {
  return (
    <div
      className={cn(
        'bg-bg flex flex-col',
        lockViewport ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden',
        className,
      )}
    >
      <main
        className={cn(
          'flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-4 md:py-6',
          lockViewport ? 'min-h-0 overflow-hidden' : 'overflow-visible',
        )}
      >
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out border-border bg-white/30',
          chromeVisible ? 'max-h-20 opacity-100 border-t' : 'max-h-0 opacity-0 border-t-0 pointer-events-none',
        )}
      >
        <footer className="px-4 py-3 md:px-6 md:py-4 text-center text-[10px] text-ink-muted uppercase tracking-widest">
          &copy; {new Date().getFullYear()} AskDrKristof &bull; Not for Crisis Support
        </footer>
      </div>
    </div>
  );
}
