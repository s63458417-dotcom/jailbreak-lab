import React, { ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserDashboard from './pages/UserDashboard';
import AdminPanel from './pages/AdminPanel';
import ChatInterface from './pages/ChatInterface';
import UserProfile from './pages/UserProfile';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-red-500 p-10 font-mono flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">SYSTEM CRITICAL FAILURE</h1>
          <div className="bg-neutral-900 p-6 rounded border border-red-900/50 max-w-2xl w-full overflow-auto">
            <p className="mb-2 text-white">The application encountered a fatal error:</p>
            <pre className="text-sm whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-700 text-white rounded hover:bg-red-600 transition-colors"
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [route, setRoute] = useState<string>(window.location.hash || '#/dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      let hash = window.location.hash;
      if (hash.endsWith('/') && hash.length > 1) {
          hash = hash.slice(0, -1);
      }
      if (!hash || hash === '#') hash = '#/dashboard';
      setRoute(hash);
    };

    handleHashChange();
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!user) {
    if (route === '#/signup') return <Signup />;
    return <Login />;
  }

  // Routing Logic
  
  if (route.startsWith('#/chat/')) {
    const parts = route.split('/chat/');
    if (parts.length > 1) {
        // Strip any extra params if they exist from old links
        const personaId = parts[1].split('/')[0];
        return <ChatInterface personaId={personaId} />;
    }
  }
  
  if (route === '#/profile') {
      return <UserProfile />;
  }

  if (route === '#/admin') {
    return isAdmin ? <AdminPanel /> : (
        <div className="h-screen flex flex-col items-center justify-center bg-neutral-950 text-red-500 font-mono">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-xl font-bold">ACCESS DENIED</div>
            <div className="text-sm opacity-75 mt-2">ADMIN CLEARANCE REQUIRED</div>
            <button onClick={() => window.location.hash = '#/dashboard'} className="mt-8 text-neutral-400 hover:text-white underline">Return to Hub</button>
        </div>
    );
  }

  return <UserDashboard />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
};

export default App;