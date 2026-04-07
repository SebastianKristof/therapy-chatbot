import React from 'react';
import { motion } from 'motion/react';
import { MODES } from '../constants';
import { Mode } from '../types';
import ModeCard from './ModeCard';

interface HomeScreenProps {
  onSelectMode: (mode: Mode) => void;
}

export default function HomeScreen({ onSelectMode }: HomeScreenProps) {
  return (
    <motion.div 
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12 py-8"
    >
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-serif font-semibold text-ink leading-tight">
          What would help most right now?
        </h2>
        <p className="text-lg text-ink-muted font-sans max-w-md mx-auto">
          Choose a guided mode to begin your private support session.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {MODES.map((mode, index) => (
          <ModeCard 
            key={mode.id} 
            mode={mode} 
            index={index} 
            onClick={() => onSelectMode(mode.id)} 
          />
        ))}
      </div>
      
      <div className="pt-12 text-center">
        <button 
          onClick={() => onSelectMode('chat')}
          className="btn-ghost text-sm flex items-center gap-2 mx-auto"
        >
          Or start an open chat
        </button>
      </div>
    </motion.div>
  );
}
