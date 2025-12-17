
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Signup: React.FC = () => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (username.length < 3) { setError('Codename too short (min 3 chars).'); return; }
    if (password.length < 4) { setError('Passcode too weak (min 4 chars).'); return; }
    setLoading(true);
    try {
        const success = await register(username, password);
        if (!success) setError('IDENT_COLLISION: Codename already claimed.');
    } catch (err: any) {
        setError(`UPLINK_FAILURE: ${err.message || 'Error occurred during registration.'}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-[#ececec] p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mb-4 bg-brand-600 shadow-lg shadow-brand-900/20">
                +
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Registration</h2>
            <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">Secure Handshake Protocol</p>
        </div>

        <div className="bg-[#212121] rounded-2xl p-8 border border-[#2e2e2e] shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Codename</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 transition-all font-mono text-sm" placeholder="OPERATOR_ID" required />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Passcode</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 transition-all font-mono text-sm" placeholder="••••••••" required />
            </div>
            {error && <div className="text-xs text-red-400 bg-red-900/10 border border-red-500/20 p-4 rounded-xl leading-relaxed">{error}</div>}
            <button type="submit" disabled={loading} className="w-full h-14 rounded-xl font-bold uppercase tracking-widest text-sm bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/20 transition-all active:scale-95">
              {loading ? 'INITIALIZING...' : 'BEGIN MISSION'}
            </button>
          </form>
          <div className="mt-8 text-center text-sm text-neutral-500">
              Already authorized? <a href="#/" className="text-neutral-300 hover:text-white ml-1 underline decoration-neutral-700">Log in</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
