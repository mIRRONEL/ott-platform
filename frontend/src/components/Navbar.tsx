import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Home, Compass, User, Upload, Shield, CreditCard, Bell, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

export default function Navbar() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl hover:text-primary transition">
            <Compass size={28} className="text-primary" />
            OTT Platform
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                isActive('/') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Home size={20} />
              Home
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  to="/browse"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/browse') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Compass size={20} />
                  Browse
                </Link>

                <Link
                  to="/upload"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/upload') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Upload size={20} />
                  Upload
                </Link>

                <Link
                  to="/profile"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/profile') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <User size={20} />
                  Profile
                </Link>

                <Link
                  to="/admin"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/admin') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Shield size={20} />
                  Admin
                </Link>

                <Link
                  to="/payment"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/payment') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <CreditCard size={20} />
                  Payment
                </Link>

                <Link
                  to="/notifications"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/notifications') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Bell size={20} />
                  Notifications
                </Link>

                <Link
                  to="/analytics"
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isActive('/analytics') ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 size={20} />
                  Analytics
                </Link>
              </>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Logout
              </button>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="px-4 py-2 text-slate-300 hover:bg-slate-800 rounded-lg transition flex items-center gap-2"
                >
                  <LogIn size={20} />
                  Login
                </Link>
                <Link
                  to="/auth/signup"
                  className="px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-lg transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
