import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Onboarding from './components/Onboarding';
import HomeScreen from './components/HomeScreen';
import ChatScreen from './components/ChatScreen';

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('askdrkristof_onboarded') === 'true';
  });
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat'>('home');
  const [chromeVisible, setChromeVisible] = useState(true);

  const handleOnboardingComplete = () => {
    setHasOnboarded(true);
    localStorage.setItem('askdrkristof_onboarded', 'true');
  };

  const handleStartChat = () => {
    setCurrentScreen('chat');
    setChromeVisible(true);
  };

  const handleResetChat = () => {
    setCurrentScreen('home');
    setChromeVisible(true);
  };

  const lockViewport = hasOnboarded && currentScreen === 'chat';

  return (
    <Layout chromeVisible={chromeVisible} lockViewport={lockViewport}>
      {!hasOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : currentScreen === 'home' ? (
        <HomeScreen onStartChat={handleStartChat} />
      ) : (
        <ChatScreen
          key="chat"
          mode="chat"
          onReset={handleResetChat}
          onChromeVisibilityChange={setChromeVisible}
        />
      )}
    </Layout>
  );
}
