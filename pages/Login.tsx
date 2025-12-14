import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import Input from '../components/Input';
import Button from '../components/Button';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { config } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Access Denied. Invalid credentials.');
    }
  };

  const handleSignupClick = (e: React.MouseEvent) => {
      e.preventDefault();
      window.location.hash = '#/signup';
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
            {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="h-16 w-auto rounded shadow-lg shadow-brand-600/20" />
            ) : (
                <div className="w-12 h-12 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-brand-600/20">
                    {config.appName.charAt(0)}
                </div>
            )}
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white tracking-tight">
          {config.appName}
        </h2>
        <p className="mt-2 text-center text-xs font-mono text-brand-500 uppercase tracking-widest">
          {config.creatorName}
        </p>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Need access? <a href="#/signup" onClick={handleSignupClick} className="font-medium text-brand-500 hover:text-brand-400 transition-colors">Sign up</a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900 py-8 px-4 shadow-2xl shadow-black sm:rounded-lg sm:px-10 border border-neutral-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input 
              label="Codename / Username" 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
            <Input 
              label="Passcode" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="rounded-md bg-brand-900/30 p-4 border border-brand-900/50">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-brand-500">Authentication Error</h3>
                    <div className="text-sm text-brand-200/70 mt-1">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Button type="submit" fullWidth>
                Authenticate
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;