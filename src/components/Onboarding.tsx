import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to AskDrKristof",
      content: "This is a private, structured AI companion trained on Dr. Kristof's materials and approach. It's designed to support you between your hypnosis sessions.",
      icon: Shield,
      color: "text-accent"
    },
    {
      title: "How it helps",
      content: "You can start with a helpful direction, ask freely, then use short suggestions to keep the conversation moving in a useful way.",
      icon: Info,
      color: "text-blue-600"
    },
    {
      title: "Important Boundaries",
      content: "This is an AI, not Dr. Kristof. It is NOT for crisis or emergency support. If you are in immediate danger, please contact local emergency services.",
      icon: AlertTriangle,
      color: "text-amber-600"
    },
    {
      title: "Ready to start?",
      content: "By continuing, you acknowledge that this is an AI tool and you understand its purpose and boundaries.",
      icon: CheckCircle,
      color: "text-emerald-600",
      buttonText: "I Understand & Accept"
    }
  ];

  const currentStep = steps[step];

  return (
    <motion.div 
      key="onboarding"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center text-center space-y-8 py-12"
    >
      <div className={cn("w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center", currentStep.color)}>
        <currentStep.icon size={32} />
      </div>
      
      <div className="space-y-4 max-w-md">
        <h2 className="text-3xl font-serif font-semibold text-ink">{currentStep.title}</h2>
        <p className="text-lg text-ink-muted leading-relaxed font-sans">
          {currentStep.content}
        </p>
      </div>
      
      <div className="flex flex-col gap-4 w-full max-w-xs pt-8">
        <button 
          onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()}
          className="btn-primary w-full"
        >
          {currentStep.buttonText || "Continue"}
        </button>
        
        {step > 0 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="btn-ghost text-sm"
          >
            Back
          </button>
        )}
      </div>
      
      <div className="flex gap-2 pt-4">
        {steps.map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i === step ? "bg-accent w-6" : "bg-accent-light"
            )} 
          />
        ))}
      </div>
    </motion.div>
  );
}
