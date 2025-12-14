import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';

const UserProfile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus('idle');

      if (password && password !== confirmPassword) {
          setStatus('error');
          setStatusMsg("Passwords do not match.");
          return;
      }
      
      const success = await updateProfile(username, password);
      if (success) {
          setStatus('success');
          setStatusMsg("Profile updated successfully.");
          setPassword('');
          setConfirmPassword('');
      } else {
          setStatus('error');
          setStatusMsg("Failed to update profile. Username might be taken.");
      }
  };

  return (
    <Layout title="Operative Profile">
      <div className="max-w-2xl mx-auto">
        <div className="bg-neutral-900 rounded-lg shadow-sm border border-neutral-800 p-8">
            <div className="flex items-center gap-6 mb-8 pb-8 border-b border-neutral-800">
                <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-3xl font-bold text-neutral-400 border-2 border-neutral-700 shadow-inner">
                    {user?.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">{user?.username}</h2>
                    <p className="text-sm text-neutral-500 font-mono">{user?.role} // {user?.id}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                     <h3 className="text-lg font-medium text-white mb-4">Account Credentials</h3>
                     <Input 
                        label="Codename (Username)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                     />
                 </div>

                 <div className="pt-4 border-t border-neutral-800">
                     <h3 className="text-lg font-medium text-white mb-2">Security Update</h3>
                     <p className="text-xs text-neutral-500 mb-4">Leave blank to keep current password.</p>
                     
                     <Input 
                        label="New Passcode"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                     />
                     
                     <Input 
                        label="Confirm Passcode"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                     />
                 </div>

                 {status !== 'idle' && (
                     <div className={`p-4 rounded border ${status === 'success' ? 'bg-green-900/20 border-green-900/50 text-green-400' : 'bg-red-900/20 border-red-900/50 text-red-400'}`}>
                         {statusMsg}
                     </div>
                 )}

                 <div className="pt-4">
                     <Button type="submit">Update Credentials</Button>
                 </div>
            </form>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;