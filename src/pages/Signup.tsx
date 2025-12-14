import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';

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
          setError('Codename already taken. Choose another.');
        }
    } catch (err) {
        setError('An unexpected system error occurred.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center text-white font-bold text-2xl border border-neutral-700">P</div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          New Operator Registration
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Already authorized? <a href="#/" className="font-medium text-brand-500 hover:text-brand-400 transition-colors">Login</a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900 py-8 px-4 shadow-2xl shadow-black sm:rounded-lg sm:px-10 border border-neutral-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input 
              label="Codename (Username)" 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="e.g. neo"
              disabled={loading}
              autoFocus
            />
            <Input 
              label="Passcode" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Minimum 8 characters"
              disabled={loading}
            />
            
            {error && (
              <div className="rounded-md bg-brand-900/30 p-4 border border-brand-900/50">
                 <div className="text-sm text-brand-200/70">{error}</div>
              </div>
            )}

            <div>
              <Button type="submit" fullWidth variant="primary" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;