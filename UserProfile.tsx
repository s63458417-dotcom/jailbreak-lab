
import React, { useState } from 'react';
import Layout from './Layout';
import { useAuth } from './AuthContext';

const UserProfile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await updateProfile(username, password);
      if (success) alert("Profile Updated");
  };

  return (
    <Layout title="Operative Profile">
      <div className="max-w-2xl mx-auto bg-[#171717] rounded-xl p-8 border border-[#262626]">
          <h2 className="text-xl font-bold mb-6">Account Settings</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
               <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#0d0d0d] border border-[#262626] rounded p-3 text-white" placeholder="Username" required />
               <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#0d0d0d] border border-[#262626] rounded p-3 text-white" placeholder="New Passcode (optional)" />
               <button type="submit" className="w-full bg-brand-600 py-3 rounded font-bold">Update Credentials</button>
          </form>
      </div>
    </Layout>
  );
};
export default UserProfile;
