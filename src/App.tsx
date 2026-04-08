import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import AccessScreen from './components/AccessScreen';
import Onboarding from './components/Onboarding';
import HomeScreen from './components/HomeScreen';
import ChatScreen from './components/ChatScreen';
import { fetchAccessStatus, isLocalDevelopmentHost, type AccessStatus } from './lib/access';

type Screen = 'home' | 'access' | 'chat';

function getScreenFromPath(pathname: string): Screen {
  if (pathname === '/chat') {
    return 'chat';
  }

  if (pathname === '/access') {
    return 'access';
  }

  return 'home';
}

function getPathForScreen(screen: Screen) {
  switch (screen) {
    case 'chat':
      return '/chat';
    case 'access':
      return '/access';
    case 'home':
    default:
      return '/';
  }
}

export default function App() {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('askdrkristof_onboarded') === 'true';
  });
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => getScreenFromPath(window.location.pathname));
  const [chromeVisible, setChromeVisible] = useState(true);

  const navigateTo = (screen: Screen, replace = false) => {
    const nextPath = getPathForScreen(screen);

    if (window.location.pathname !== nextPath) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](null, '', nextPath);
    }

    setCurrentScreen(screen);
  };

  const refreshAccessStatus = async () => {
    const nextStatus = await fetchAccessStatus();
    setAccessStatus(nextStatus);
  };

  useEffect(() => {
    void refreshAccessStatus();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getScreenFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (currentScreen === 'access' && accessStatus?.authorized) {
      navigateTo('chat', true);
      setChromeVisible(true);
    }
  }, [accessStatus, currentScreen]);

  const handleOnboardingComplete = () => {
    setHasOnboarded(true);
    localStorage.setItem('askdrkristof_onboarded', 'true');
  };

  const handleStartChat = () => {
    if (isLocalDevelopmentHost() || accessStatus?.authorized) {
      navigateTo('chat');
    } else {
      navigateTo('access');
    }
    setChromeVisible(true);
  };

  const handleResetChat = () => {
    navigateTo('home');
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
