import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Inline logo for modal consistency
const TarantulaHawkLogo = ({ className = "w-10 h-10 mb-4 mx-auto" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#CC3300'}} />
        <stop offset="50%" style={{stopColor: '#FF4500'}} />
        <stop offset="100%" style={{stopColor: '#FF6B00'}} />
      </linearGradient>
      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#00CED1'}} />
        <stop offset="50%" style={{stopColor: '#20B2AA'}} />
        <stop offset="100%" style={{stopColor: '#48D1CC'}} />
      </linearGradient>
    </defs>
    <circle cx="200" cy="200" r="190" fill="none" stroke="url(#tealGrad)" strokeWidth="3" opacity="0.4"/>
    <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A"/>
    <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F"/>
    <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F"/>
    <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A"/>
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#orangeGrad)" opacity="0.95"/>
    <ellipse cx="200" cy="245" rx="30" ry="9" fill="url(#orangeGrad)" opacity="0.9"/>
    <ellipse cx="200" cy="270" rx="27" ry="8" fill="url(#orangeGrad)" opacity="0.85"/>
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <path d="M 200 305 L 197 330 L 200 350 L 203 330 Z" fill="url(#orangeGrad)"/>
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
  </svg>
);

interface OnboardingFormProps {
  onClose: () => void;
}

export default function OnboardingForm({ onClose }: OnboardingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, company, trial: true },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-8 text-gray-500 hover:text-white text-2xl">×</button>
        <TarantulaHawkLogo />
        <h2 className="text-2xl font-black mb-2 text-center bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">Sign Up for Free Trial</h2>
        <p className="text-gray-400 text-center mb-6">Create your account to access the AML platform. No credit card required.</p>
        {success ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2 text-green-400">Account Created!</h2>
            <p className="text-gray-400 mb-6">Check your email to verify your account and start your free trial.</p>
            <button onClick={onClose} className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="text-red-500 mb-2 text-center font-semibold">{error}</div>}
            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" />
            <input type="text" placeholder="Company (optional)" value={company} onChange={e => setCompany(e.target.value)} className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" />
            <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold hover:from-red-700 hover:to-orange-600 transition flex items-center justify-center gap-2">
              {loading ? 'Signing Up...' : 'Start Free Trial'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
