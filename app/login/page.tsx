'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Beef, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      router.replace('/');
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const result = await res.json();

      if (result.success) {
        localStorage.setItem('token', result.data.tokens.accessToken);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        window.location.replace('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-6">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/30 animate-pulse">
          <Beef className="w-10 h-10 text-white" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">FarmMaster</h1>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Initializing system...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden text-slate-900 font-geist-sans">
      {/* Decorative Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/30 rounded-full blur-[140px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-100/30 rounded-full blur-[140px]" />

      <div className="w-full max-w-xl p-16 bg-white/70 backdrop-blur-3xl rounded-[64px] border border-white shadow-2xl shadow-slate-900/5 relative z-10 mx-6">
        <div className="flex flex-col items-center mb-16">
          <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center shadow-3xl shadow-blue-600/30 mb-8 transition-all hover:scale-105 duration-500 rotate-6 hover:rotate-0">
            <Beef className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-900 mb-4">FarmMaster<span className="text-blue-600">.</span></h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Cloud Enterprise Infrastructure</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-10">
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Identifier</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                <Mail className="h-6 w-6" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full pl-20 pr-8 py-6 bg-slate-50 border border-slate-100 rounded-[32px] font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all duration-300 shadow-inner"
                placeholder="Email or User ID"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Security Key</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                <Lock className="h-6 w-6" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-20 pr-8 py-6 bg-slate-50 border border-slate-100 rounded-[32px] font-black tracking-[0.3em] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all duration-300 shadow-inner"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-rose-600 text-sm font-black bg-rose-50 border border-rose-100 p-6 rounded-[32px] flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
              <span className="text-2xl">⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group w-full flex items-center justify-center gap-4 py-8 px-8 border-b-8 border-blue-800 rounded-[48px] shadow-3xl shadow-blue-600/30 text-xl font-black text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-8 focus:ring-blue-500/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] uppercase tracking-[0.2em]"
          >
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              <>
                <span>Establish Session</span>
                <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-20 pt-10 border-t border-slate-50 text-center">
          <p className="text-[10px] text-slate-300 italic font-medium uppercase tracking-[0.2em]">
            Precision Agriculture Mastery &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}
