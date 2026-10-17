import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Sparkles, AlertCircle, Film, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

export default function SignupPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state: any) => state.setToken);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.signup(email, password, firstName, lastName);
      setToken(response.access_token);
      navigate('/browse');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#07090e] flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Ambient background glows */}
      <div className="ambient-glow -top-20 right-1/3 w-[500px] h-[500px] bg-brand-600/25" />
      <div className="ambient-glow -bottom-20 left-1/3 w-[450px] h-[450px] bg-brand-neon/20" />

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
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Create Your Account</h1>
          <p className="text-sm text-slate-400 mt-1">Unlock 4K streaming, offline access, and personalized watchlists</p>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                    placeholder="John"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Last Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Mail size={17} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Lock size={17} />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm transition-all"
                  placeholder="Min. 6 characters"
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
              className="btn-primary w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-glow disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Get Started'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-brand-400 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
