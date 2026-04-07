import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Onboarding from './components/Onboarding';
import HomeScreen from './components/HomeScreen';
import ChatScreen from './components/ChatScreen';
import { Mode } from './types';

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('askdrkristof_onboarded') === 'true';
  });
  
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);

  const handleOnboardingComplete = () => {
    setHasOnboarded(true);
    localStorage.setItem('askdrkristof_onboarded', 'true');
  };

  const handleSelectMode = (mode: Mode) => {
    setCurrentMode(mode);
  };

  const handleBack = () => {
    setCurrentMode(null);
  };

  return (
    <Layout>
      {!hasOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : currentMode ? (
        <ChatScreen mode={currentMode} onBack={handleBack} />
      ) : (
        <HomeScreen onSelectMode={handleSelectMode} />
      )}
    </Layout>
  );
}
