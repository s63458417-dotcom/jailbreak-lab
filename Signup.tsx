
import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const Signup: React.FC = () => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) return setError('Name too short.');
    const success = await register(username, password);
    if (!success) setError('Failed or already exists.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
      <div className="w-full max-w-md p-8 bg-[#171717] rounded-2xl border border-[#2e2e2e] shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">Registration</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 font-mono text-sm" placeholder="OPERATOR_ID" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 font-mono text-sm" placeholder="••••••••" required />
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button type="submit" className="w-full h-14 rounded-xl font-bold uppercase tracking-widest text-sm bg-brand-600 hover:bg-brand-500 transition-all">BEGIN MISSION</button>
        </form>
        <div className="mt-8 text-center text-sm text-neutral-500">
            Already authorized? <a href="#/" className="text-brand-400 hover:underline">Log in</a>
        </div>
      </div>
    </div>
  );
};
export default Signup;
