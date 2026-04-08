import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import AccessScreen from './components/AccessScreen';
import Onboarding from './components/Onboarding';
import HomeScreen from './components/HomeScreen';
import ChatScreen from './components/ChatScreen';
import { fetchAccessStatus, isLocalDevelopmentHost, type AccessStatus } from './lib/access';

export default function App() {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('askdrkristof_onboarded') === 'true';
  });
  const [currentScreen, setCurrentScreen] = useState<'home' | 'access' | 'chat'>('home');
  const [chromeVisible, setChromeVisible] = useState(true);

  const refreshAccessStatus = async () => {
    const nextStatus = await fetchAccessStatus();
    setAccessStatus(nextStatus);
  };

  useEffect(() => {
    void refreshAccessStatus();
  }, []);

  useEffect(() => {
    if (currentScreen === 'access' && accessStatus?.authorized) {
      setCurrentScreen('chat');
      setChromeVisible(true);
    }
  }, [accessStatus, currentScreen]);

  const handleOnboardingComplete = () => {
    setHasOnboarded(true);
    localStorage.setItem('askdrkristof_onboarded', 'true');
  };

  const handleStartChat = () => {
    if (isLocalDevelopmentHost() || accessStatus?.authorized) {
      setCurrentScreen('chat');
    } else {
      setCurrentScreen('access');
    }
    setChromeVisible(true);
  };

  const handleResetChat = () => {
    setCurrentScreen('home');
    setChromeVisible(true);
  };

  return (
    <Layout chromeVisible={chromeVisible} lockViewport={false}>
      {!accessStatus ? (
        <div className="py-10 text-center text-ink-muted">Checking access...</div>
      ) : !hasOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : currentScreen === 'home' ? (
        <HomeScreen onStartChat={handleStartChat} />
      ) : currentScreen === 'access' ? (
        <AccessScreen accessStatus={accessStatus} onRetry={refreshAccessStatus} />
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
