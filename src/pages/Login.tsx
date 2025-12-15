
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-[#ececec]">
      <div className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4">
                {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                ) : (
                    config.appName.charAt(0)
                )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                {config.appName}
            </h2>
            <p className="text-neutral-500 text-sm">
                Enter your credentials to continue
            </p>
        </div>

        <div className="bg-[#212121] rounded-2xl p-8 border border-[#2e2e2e] shadow-xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
                <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-600"
                  placeholder="Codename"
                  autoFocus
                  required
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-600"
                  placeholder="Passcode"
                  required
                />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/10 border border-red-900/20 p-3 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <button 
                type="submit" 
                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg transition-colors shadow-lg shadow-brand-900/20 mt-2"
            >
              Log In
            </button>
          </form>
          
          <div className="mt-6 text-center">
              <p className="text-sm text-neutral-500">
                  No account? <a href="#/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign up</a>
              </p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-neutral-600 font-mono">
            SECURE TERMINAL ACCESS // {config.creatorName}
        </p>
      </div>
    </div>
  );
};

export default Login;
