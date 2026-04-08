import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock3, ShieldAlert, MessageSquareMore } from 'lucide-react';
import { cn } from '../lib/utils';

interface HomeScreenProps {
  onStartChat: () => void;
}

export default function HomeScreen({ onStartChat }: HomeScreenProps) {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const panels = [
    {
      text: "This is a private AI support companion trained on Dr. Kristof's materials and approach.",
      icon: MessageSquareMore,
    },
    {
      text: 'Use it to reflect, prepare, and stay connected to the work between sessions.',
      icon: ShieldAlert,
    },
    {
      text: 'Current clients can mark selected questions to send to Dr. Kristof within 48 hours.',
      icon: Clock3,
    },
  ];

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col py-6 md:py-8"
    >
      <div className="space-y-6 md:space-y-7">
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src="/logo-mark.svg"
              alt="AskDrKristof"
              className="h-14 w-14 shrink-0 rounded-2xl"
            />
            <div>
              <h1 className="text-2xl font-serif font-semibold tracking-tight text-ink md:text-3xl">
                AskDrKristof
              </h1>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-xl text-center">
          <p className="text-base leading-relaxed text-ink-muted md:text-lg">
            Ask freely and use the chat for support between sessions.
          </p>
        </div>

        <div className="grid gap-3 md:gap-4">
          {panels.map(({ text, icon: Icon }) => (
            <div
              key={text}
              className="flex items-start gap-4 rounded-[2rem] border border-border bg-white/75 p-5 shadow-sm backdrop-blur-sm md:items-center md:p-6"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-accent">
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="max-w-2xl text-base leading-relaxed text-ink md:text-lg">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 pt-2">
          <label className="flex w-full items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm leading-relaxed text-ink-muted">
            <input
              type="checkbox"
              checked={hasAcknowledged}
              onChange={(event) => setHasAcknowledged(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
            />
            <span>I understand this tool is not Dr. Kristof and it is NOT for crisis support.</span>
          </label>

          <button
            type="button"
            onClick={onStartChat}
            disabled={!hasAcknowledged}
            className={cn(
              'inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
            )}
          >
            Start chat
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
