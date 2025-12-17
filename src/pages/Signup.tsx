
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';

const Signup: React.FC = () => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    // Clear only if the user hasn't typed anything new
    setError('');
    
    if (username.length < 3) {
      setError('Codename too short (min 3 chars).');
      return;
    }
    
    if (password.length < 4) {
      setError('Passcode too weak (min 4 chars).');
      return;
    }

    setLoading(true);
    try {
        const success = await register(username, password);
        if (!success) {
          setError('IDENT_COLLISION: Codename already claimed in this sector.');
        }
    } catch (err: any) {
        setError(`UPLINK_FAILURE: ${err.message || 'The neural link dropped.'}`);
    } finally {
        setLoading(false);
    }
  };

  const cloudActive = isSupabaseConfigured();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-[#ececec] p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mb-4 border transition-colors ${cloudActive ? 'bg-brand-600 border-brand-500 shadow-brand-500/20 shadow-lg' : 'bg-neutral-800 border-neutral-700'}`}>
                {cloudActive ? '☁️' : '+'}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                Operative Onboarding
            </h2>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${cloudActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">
                    {cloudActive ? 'Shared Network Active' : 'Local Terminal Mode'}
                </p>
            </div>
        </div>

        <div className="bg-[#212121] rounded-2xl p-8 border border-[#2e2e2e] shadow-2xl relative overflow-hidden">
          {/* Subtle glow if cloud is active */}
          {cloudActive && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2.5">Operator Codename</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-700 font-mono text-sm"
                  placeholder="e.g. ZERO_ONE"
                  autoFocus
                  required
                />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2.5">Security Passcode</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#161616] border border-[#333] text-white rounded-xl px-5 py-3.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-700 font-mono text-sm"
                  placeholder="••••••••"
                  required
                />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-900/10 border border-red-500/20 p-4 rounded-xl leading-relaxed animate-in fade-in slide-in-from-top-2">
                 <div className="flex gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{error}</span>
                 </div>
              </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className={`w-full h-14 rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${cloudActive ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/20' : 'bg-white hover:bg-neutral-200 text-black'}`}
            >
              {loading ? (
                  <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      INITIALIZING...
                  </span>
              ) : 'BEGIN MISSION'}
            </button>
          </form>
          
          <div className="mt-8 text-center">
              <p className="text-sm text-neutral-600 font-medium">
                  Already authorized? <a href="#/" className="text-neutral-300 hover:text-white transition-colors border-b border-neutral-800 pb-0.5 ml-1">Log in</a>
              </p>
          </div>
        </div>
        
        {!cloudActive && (
            <div className="mt-8 bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl">
                <p className="text-[10px] text-neutral-500 leading-relaxed text-center font-mono">
                    <span className="text-yellow-600 font-bold uppercase">Note:</span> Shared cloud is currently offline. Your data will stay on this device only until an Admin links the Global Uplink.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
