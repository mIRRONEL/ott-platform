import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Film, Shield, Zap, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative bg-dark-950 border-t border-white/[0.08] pt-16 pb-12 overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="ambient-glow -bottom-32 left-1/4 w-[500px] h-[300px] bg-yellow-500/10 pointer-events-none" />
      <div className="ambient-glow -bottom-32 right-1/4 w-[400px] h-[300px] bg-lime-500/10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-lime-400 p-0.5 shadow-lg shadow-yellow-500/30 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#050a06] rounded-[10px] flex items-center justify-center">
                  <Film size={20} className="text-yellow-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-lime-400">SoNALU</span>
                <span className="text-[9px] uppercase tracking-[0.25em] text-lime-400 font-bold">Ultra HD 4K Cinema</span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              SoNALU next-generation streaming platform with multi-bitrate HLS video encoding, sub-second latency, and ultra-high fidelity audio-visual playback.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              All 9 Microservices Operational
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Discover</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/browse" className="text-slate-400 hover:text-white transition-colors">Browse Movies</Link>
              </li>
              <li>
                <Link to="/browse" className="text-slate-400 hover:text-white transition-colors">TV Series & Shows</Link>
              </li>
              <li>
                <Link to="/browse" className="text-slate-400 hover:text-white transition-colors">New Releases</Link>
              </li>
              <li>
                <Link to="/browse" className="text-slate-400 hover:text-white transition-colors">Trending 4K</Link>
              </li>
            </ul>
          </div>

          {/* Platform & Account */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Account & Studio</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/upload" className="text-slate-400 hover:text-white transition-colors">Upload Studio</Link>
              </li>
              <li>
                <Link to="/payment" className="text-slate-400 hover:text-white transition-colors">VIP Subscription</Link>
              </li>
              <li>
                <Link to="/analytics" className="text-slate-400 hover:text-white transition-colors">Viewing Insights</Link>
              </li>
              <li>
                <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">Admin Console</Link>
              </li>
            </ul>
          </div>

          {/* Tech Specs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Architecture</h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Zap size={14} className="text-brand-400" />
                <span>Kafka KRaft Event Mesh</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Film size={14} className="text-brand-neon" />
                <span>FFmpeg Multi-Bitrate HLS</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Shield size={14} className="text-emerald-400" />
                <span>Zero-Trust API Gateway</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Globe size={14} className="text-cyan-400" />
                <span>Elasticsearch 8 Ingestion</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} SoNALU OTT Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">API Docs</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
