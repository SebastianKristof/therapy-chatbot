import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Copy, Loader2, RefreshCw } from 'lucide-react';
import type { AccessStatus } from '../lib/access';
import { regenerateAccessCredentials } from '../lib/access';

interface AccessScreenProps {
  accessStatus: AccessStatus;
  onRetry: () => Promise<void> | void;
}

export default function AccessScreen({ accessStatus, onRetry }: AccessScreenProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [isChecking, setIsChecking] = useState(false);
  const approvalEntry = `${accessStatus.clientToken} ${accessStatus.deviceId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(approvalEntry);
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

  const handleCheckApproval = async () => {
    if (isChecking) {
      return;
    }

    setIsChecking(true);
    const startedAt = Date.now();

    try {
      await onRetry();
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 850 - elapsed);
      window.setTimeout(() => setIsChecking(false), remaining);
    }
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
          Share this approval entry privately with the app owner to request access.
        </p>
      </div>

      <div className="w-full rounded-[2rem] border border-border bg-white/80 p-6 text-left shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.32em] text-ink-muted">Approval Entry</div>
        <div className="mt-3 break-all rounded-2xl border border-border bg-bg/70 px-4 py-4 font-mono text-sm text-ink">
          {approvalEntry}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{accessStatus.message}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <Copy size={16} />
          {copyState === 'copied' ? 'Copied' : 'Copy token'}
        </button>
        <button
          type="button"
          onClick={handleCheckApproval}
          disabled={isChecking}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white/75 px-5 py-3 text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isChecking ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking...
            </>
          ) : (
            'Check approval'
          )}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white/75 px-5 py-3 text-ink transition-colors hover:bg-white"
        >
          <RefreshCw size={16} />
          Generate new token
        </button>
      </div>
    </motion.div>
  );
}
