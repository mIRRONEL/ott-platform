import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import BrowsePage from './pages/BrowsePage';
import ProfilePage from './pages/ProfilePage';
import UploadPage from './pages/UploadPage';
import AdminDashboard from './pages/AdminDashboard';
import PaymentPage from './pages/PaymentPage';
import NotificationPage from './pages/NotificationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LiveTVPage from './pages/LiveTVPage';
import LivePage from './pages/LivePage';
import AdminLiveStudioPage from './pages/AdminLiveStudioPage';
import SystemHealthPage from './pages/SystemHealthPage';
import { useAuthStore } from './stores/auth';
import './index.css';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <div className="min-h-screen bg-[#050a06] text-slate-100 flex flex-col selection:bg-yellow-400 selection:text-black">
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />

            {/* Admin-Only Observability & System Health Routes */}
            <Route
              path="/system"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SystemHealthPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/health"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SystemHealthPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/system"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SystemHealthPage />
                </ProtectedRoute>
              }
            />

            {/* Live Streaming & Creator Studio Routes */}
            <Route
              path="/live"
              element={
                <ProtectedRoute>
                  <LivePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/:channelId"
              element={
                <ProtectedRoute>
                  <LivePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/live"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLiveStudioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/studio"
              element={
                <ProtectedRoute>
                  <AdminLiveStudioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse"
              element={
                <ProtectedRoute>
                  <BrowsePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment"
              element={
                <ProtectedRoute>
                  <PaymentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

