
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { config } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (!success) setError('Access Denied.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
      <div className="w-full max-w-md p-8 bg-[#171717] rounded-2xl border border-[#2e2e2e] shadow-2xl">
        <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center font-bold text-2xl mb-4">
                {config.logoUrl ? <img src={config.logoUrl} className="w-full h-full rounded-xl" /> : config.appName.charAt(0)}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{config.appName}</h2>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500" placeholder="Codename" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500" placeholder="Passcode" required />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg">Log In</button>
        </form>
        <div className="mt-6 text-center text-sm text-neutral-500">
            No account? <a href="#/signup" className="text-brand-400 hover:underline">Sign up</a>
        </div>
      </div>
    </div>
  );
};
export default Login;
