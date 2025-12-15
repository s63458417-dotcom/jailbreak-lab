
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
    setError('');
    setLoading(true);
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      setLoading(false);
      return;
    }
    
    try {
        const success = await register(username, password);
        if (!success) {
          setError('Username already taken.');
        }
    } catch (err) {
        setError('An unexpected error occurred.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-[#ececec]">
      <div className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4">
                +
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                Create Account
            </h2>
            <p className="text-neutral-500 text-sm">
                Join the platform
            </p>
        </div>

        <div className="bg-[#212121] rounded-2xl p-8 border border-[#2e2e2e] shadow-xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
                <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Choose Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-600"
                  placeholder="username"
                  autoFocus
                  required
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Set Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#2f2f2f] border border-[#404040] text-white rounded-lg px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-neutral-600"
                  placeholder="Min 8 chars"
                  required
                />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/10 border border-red-900/20 p-3 rounded-lg flex items-center gap-2">
                 <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 {error}
              </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-white hover:bg-neutral-200 text-black font-medium py-3 rounded-lg transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Register'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
              <p className="text-sm text-neutral-500">
                  Already have an account? <a href="#/" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Log in</a>
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
