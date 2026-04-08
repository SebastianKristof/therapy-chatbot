import React from 'react';
import { cn } from '../lib/utils';

interface BrandMarkProps {
  className?: string;
}

export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/logo-mark.svg"
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-2xl"
      />
      <div className="hidden sm:block">
        <h1 className="text-xl font-serif font-semibold tracking-tight text-ink">AskDrKristof</h1>
        <p className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">Private AI Companion</p>
      </div>
      <span className="sr-only">AskDrKristof</span>
    </div>
  );
}
