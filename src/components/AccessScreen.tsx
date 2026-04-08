import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import type { AccessStatus } from '../lib/access';
import { regenerateAccessCredentials } from '../lib/access';

interface AccessScreenProps {
  accessStatus: AccessStatus;
  onRetry: () => Promise<void> | void;
}

export default function AccessScreen({ accessStatus, onRetry }: AccessScreenProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accessStatus.clientToken);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('idle');
    }
  };

  const handleRegenerate = async () => {
    regenerateAccessCredentials();
    await onRetry();
  };

  return (
    <motion.div
      key="access"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm text-accent">
        <CheckCircle2 size={30} />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-serif font-semibold text-ink">Device Approval Required</h2>
        <p className="text-lg leading-relaxed text-ink-muted">
          Add this device token to `config/accessTokens.txt` before using the app.
        </p>
      </div>

      <div className="w-full rounded-[2rem] border border-border bg-white/80 p-6 text-left shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">Device Token</div>
        <div className="mt-3 break-all rounded-2xl border border-border bg-bg/70 px-4 py-4 font-mono text-sm text-ink">
          {accessStatus.clientToken}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{accessStatus.message}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button type="button" onClick={handleCopy} className="btn-primary w-full">
          <Copy size={16} />
          {copyState === 'copied' ? 'Copied' : 'Copy token'}
        </button>
        <button type="button" onClick={onRetry} className="btn-ghost w-full">
          Check approval
        </button>
        <button type="button" onClick={handleRegenerate} className="btn-ghost w-full">
          <RefreshCw size={16} />
          Generate new token
        </button>
      </div>
    </motion.div>
  );
}
