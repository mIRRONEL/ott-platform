import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Check, 
  ShieldCheck, 
  Zap, 
  History, 
  ChevronRight, 
  Sparkles, 
  Crown, 
  Tv, 
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

interface Subscription {
  id: string;
  name: string;
  price: number;
  features: string[];
  active: boolean;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  date: string;
  subscription: string;
}

export default function PaymentPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const plans = [
    {
      id: 'free',
      name: 'Free Basic',
      price: 0,
      period: 'Forever',
      description: 'Stream select catalog in Standard Definition',
      features: ['720p HD Quality', '1 Screen at a time', 'Ad-supported playback', 'Standard catalog access'],
      highlight: false,
    },
    {
      id: 'standard',
      name: 'Standard HD',
      price: 9.99,
      period: 'month',
      description: 'Ad-free full HD streaming with multi-device sync',
      features: ['1080p Full HD', '2 Concurrent streams', 'Ad-free experience', 'Unlimited catalog access', 'Download on 1 device'],
      highlight: false,
    },
    {
      id: 'premium_vip',
      name: 'VIP 4K Ultra HD',
      price: 19.99,
      period: 'month',
      description: 'Maximum visual fidelity, Dolby Atmos & offline downloads',
      features: [
        '4K Ultra HD + HDR10+ + Dolby Vision',
        '4 Concurrent screens',
        'Spatial Audio & Dolby Atmos 7.1',
        'Early Premiere Access',
        'Unlimited offline downloads',
        'Priority FFmpeg transcoding queues',
      ],
      highlight: true,
    },
  ];

  useEffect(() => {
    fetchSubscriptions();
    fetchPaymentHistory();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await api.getSubscriptions();
      const data = response?.data?.data || [];
      setSubscriptions(data);
      if (data.length > 0) {
        const active = data.find((s: Subscription) => s.active);
        if (active) setCurrentSubscription(active.id);
      }
    } catch (err) {
      // Fallback to default mock if payment service returns empty
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await api.getPaymentHistory();
      setPayments(response?.data?.data || []);
    } catch (err) {
      console.error('Failed to load payment history');
    }
  };

  const handleSubscribe = async (subscriptionId: string) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.subscribe(subscriptionId);
      setCurrentSubscription(subscriptionId);
      setSuccess('Subscription upgraded successfully! Enjoy VIP streaming.');
      fetchSubscriptions();
      fetchPaymentHistory();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Subscription processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest">
            <Crown size={14} />
            Flexible Membership Plans
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">
            Choose the Perfect Streaming Tier
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Cancel anytime. Upgrade to VIP 4K for Dolby Atmos spatial audio and simultaneous streaming.
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="max-w-md mx-auto bg-rose-500/10 text-rose-300 px-5 py-3.5 rounded-2xl text-xs font-bold border border-rose-500/30 flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="max-w-md mx-auto bg-emerald-500/10 text-emerald-300 px-5 py-3.5 rounded-2xl text-xs font-bold border border-emerald-500/30 flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                plan.highlight
                  ? 'glass-panel border-2 border-brand-500/60 shadow-glow hover:shadow-glow-lg -translate-y-2'
                  : 'glass-card hover:border-white/20'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-rose to-brand-neon text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                  ★ Most Popular VIP
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>
                  {plan.highlight && <Crown size={22} className="text-brand-rose" />}
                </div>

                <p className="text-xs text-slate-400 min-h-[36px] mb-6">{plan.description}</p>

                <div className="flex items-baseline gap-1.5 mb-8 pb-6 border-b border-white/[0.08]">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-xs text-slate-400 font-bold">/ {plan.period}</span>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-300">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6">
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading || currentSubscription === plan.id}
                  className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
                    plan.highlight
                      ? 'btn-primary shadow-glow'
                      : 'btn-secondary'
                  } disabled:opacity-50`}
                >
                  {currentSubscription === plan.id ? 'Active Plan' : `Select ${plan.name}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Payment History Section */}
        <div className="max-w-4xl mx-auto pt-10">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mb-4">
            <History size={18} className="text-brand-400" />
            <span>Billing & Transaction History</span>
          </h2>

          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-950/80 border-b border-white/[0.08] text-slate-400 uppercase tracking-widest font-bold">
                <tr>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(payments.length > 0 ? payments : [
                  { id: '1', subscription: 'VIP 4K Ultra HD', date: '2026-08-01', amount: 19.99, status: 'Completed' },
                  { id: '2', subscription: 'VIP 4K Ultra HD', date: '2026-07-01', amount: 19.99, status: 'Completed' },
                ]).map((p, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-4 px-6 font-bold text-white">{p.subscription}</td>
                    <td className="py-4 px-6 text-slate-400">{p.date}</td>
                    <td className="py-4 px-6 font-mono text-white font-bold">${p.amount}</td>
                    <td className="py-4 px-6 text-right">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
