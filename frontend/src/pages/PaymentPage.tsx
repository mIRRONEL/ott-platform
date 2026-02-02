import React, { useState, useEffect } from 'react';
import { CreditCard, Check } from 'lucide-react';
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

  useEffect(() => {
    fetchSubscriptions();
    fetchPaymentHistory();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await api.getSubscriptions();
      const data = response?.data || [];
      setSubscriptions(data);
      if (data.length > 0) {
        const active = data.find((s: Subscription) => s.active);
        if (active) setCurrentSubscription(active.id);
      }
    } catch (err) {
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await api.getPaymentHistory();
      setPayments(response?.data || []);
    } catch (err) {
      console.error('Failed to load payment history');
    }
  };

  const handleSubscribe = async (subscriptionId: string) => {
    try {
      setLoading(true);
      await api.subscribe(subscriptionId);
      setCurrentSubscription(subscriptionId);
      fetchSubscriptions();
      fetchPaymentHistory();
    } catch (err) {
      setError('Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={32} className="text-blue-500" />
            <h1 className="text-4xl font-bold">Payment & Subscriptions</h1>
          </div>
          <p className="text-slate-400">Manage your subscription and view payment history</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Subscription Plans */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subscriptions.length > 0 ? (
              subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    currentSubscription === sub.id
                      ? 'border-blue-500 bg-blue-950/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <h3 className="text-xl font-bold mb-2">{sub.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-blue-400">${sub.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>

                  {currentSubscription === sub.id && (
                    <div className="mb-4 p-2 bg-green-900/30 border border-green-500 rounded flex items-center gap-2 text-green-300">
                      <Check size={16} />
                      <span>Current Plan</span>
                    </div>
                  )}

                  <ul className="mb-6 space-y-2">
                    {sub.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-slate-300">
                        <Check size={16} className="text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {currentSubscription !== sub.id && (
                    <button
                      onClick={() => handleSubscribe(sub.id)}
                      disabled={loading}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Subscribe'}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-400">Loading subscription plans...</p>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Payment History</h2>
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Subscription</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                      <td className="px-6 py-3 text-sm">
                        {new Date(payment.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-sm">{payment.subscription}</td>
                      <td className="px-6 py-3 text-sm font-semibold">${payment.amount.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            payment.status === 'completed'
                              ? 'bg-green-900/30 text-green-300'
                              : payment.status === 'pending'
                              ? 'bg-yellow-900/30 text-yellow-300'
                              : 'bg-red-900/30 text-red-300'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No payment history
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
