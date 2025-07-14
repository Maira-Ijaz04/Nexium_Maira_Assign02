// components/AuthForm.tsx
'use client';

import { useState } from 'react';
import { signIn, signUp } from '@/lib/auth';

export default function AuthForm({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = async () => {
    setError('');
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        setSuccess('Signed in successfully!');
      } else {
        await signUp(email, password);
        setSuccess('Account created. Check your email to verify.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </h2>
      <input
        type="email"
        placeholder="Email"
        className="w-full mb-2 p-2 border rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full mb-4 p-2 border rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        className="w-full bg-blue-600 text-white py-2 rounded"
        onClick={handleAuth}
      >
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {success && <p className="text-green-500 mt-2">{success}</p>}
    </div>
  );
}
