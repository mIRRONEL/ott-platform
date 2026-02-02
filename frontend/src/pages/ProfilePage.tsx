import React, { useState, useEffect } from 'react';
import { User, LogOut, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profileResponse = await api.getUserProfile();
      setProfile(profileResponse.data);

      if (activeTab === 'watchlist') {
        const watchlistResponse = await api.getWatchlist();
        setWatchlist(watchlistResponse.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    api.logout();
    navigate('/');
  };

  const handleLoadWatchlist = async () => {
    setLoading(true);
    try {
      const response = await api.getWatchlist();
      setWatchlist(response.data.data || []);
    } catch (err) {
      console.error('Failed to load watchlist', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User size={32} />
            My Profile
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'profile'
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => {
              setActiveTab('watchlist');
              handleLoadWatchlist();
            }}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'watchlist'
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Watchlist
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="bg-slate-800 rounded-lg p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <p className="text-lg">{profile.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">First Name</label>
                  <p className="text-lg">{profile.firstName || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Last Name</label>
                  <p className="text-lg">{profile.lastName || 'N/A'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Member Since</label>
                <p className="text-lg">{new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Watchlist Tab */}
        {activeTab === 'watchlist' && (
          <div>
            {loading ? (
              <p className="text-center text-slate-400">Loading watchlist...</p>
            ) : watchlist.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Your watchlist is empty</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {watchlist.map((item) => (
                  <div key={item.videoId} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-lg flex-1">{item.title}</h3>
                      <Heart size={20} className="text-secondary" />
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{item.category}</span>
                      <span>{item.imdbRating || 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
