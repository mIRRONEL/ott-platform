import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck, Film, Sparkles, AlertCircle, KeyRound } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state: any) => state.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      setToken(response.access_token);
      navigate('/browse');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('admin@example.com');
    setPassword('admin123');
  };

  return (
    <div className="min-h-[85vh] bg-[#07090e] flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Ambient background glows */}
      <div className="ambient-glow -top-20 left-1/3 w-[500px] h-[500px] bg-brand-600/25" />
      <div className="ambient-glow -bottom-20 right-1/3 w-[450px] h-[450px] bg-brand-neon/20" />

      <div className="max-w-md w-full relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-neon p-0.5 shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-dark-950 rounded-[14px] flex items-center justify-center">
                <Film size={24} className="text-brand-400" />
              </div>
            </div>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Welcome Back</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to resume watching in Ultra HD 4K</p>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors">Forgot?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 text-rose-300 px-4 py-3 rounded-xl text-xs font-bold border border-rose-500/30 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-glow disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Stream'}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-6 pt-6 border-t border-white/[0.08] text-center">
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-slate-300 flex items-center justify-center gap-2 transition-all group"
            >
              <KeyRound size={15} className="text-brand-400 group-hover:scale-110 transition-transform" />
              <span>⚡ Fill Admin Demo Credentials</span>
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-brand-400 font-bold hover:underline">
              Sign up now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
