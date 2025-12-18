
import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { StoreProvider } from './StoreContext';
import Login from './Login';
import Signup from './Signup';
import UserDashboard from './UserDashboard';
import AdminPanel from './AdminPanel';
import ChatInterface from './ChatInterface';
import UserProfile from './UserProfile';

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

// Fix: Explicitly extending React.Component with props and state generics to resolve type access errors.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-red-500 p-10 font-mono flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">SYSTEM CRITICAL FAILURE</h1>
          <pre className="text-sm whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-700 text-white rounded hover:bg-red-600 transition-colors">Reboot</button>
        </div>
      );
    }
    // Fix: Accessing children through this.props.
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [route, setRoute] = useState<string>(window.location.hash || '#/dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      let hash = window.location.hash;
      if (!hash || hash === '#') hash = '#/dashboard';
      setRoute(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!user) {
    if (route === '#/signup') return <Signup />;
    return <Login />;
  }
  if (route.startsWith('#/chat/')) {
    const personaId = route.split('/chat/')[1]?.split('/')[0];
    return <ChatInterface personaId={personaId} />;
  }
  if (route === '#/profile') return <UserProfile />;
  if (route === '#/admin') {
    return isAdmin ? <AdminPanel /> : <div className="h-screen bg-black flex items-center justify-center text-red-500 font-bold">ACCESS DENIED</div>;
  }
  return <UserDashboard />;
};

const App: React.FC = () => (
  <ErrorBoundary>
    <StoreProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </StoreProvider>
  </ErrorBoundary>
);

export default App;
