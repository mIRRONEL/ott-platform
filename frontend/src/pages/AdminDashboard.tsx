import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Ban, 
  Shield, 
  Search, 
  ChevronLeft, 
  Plus, 
  Key, 
  X, 
  Users, 
  UserPlus, 
  FileCheck, 
  ShieldAlert, 
  Mail, 
  Globe, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Zap,
  Activity,
  Layers,
  Download,
  FileText,
  Filter,
  Lock,
  RefreshCw,
  Clock,
  SlidersHorizontal
} from 'lucide-react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'admin' | 'moderator';
  is_banned: boolean;
  created_at: string;
  last_login?: string;
  country?: string;
}

interface Stats {
  total_users: number;
  banned_users: number;
  admin_users: number;
  new_users_week: number;
}

export default function AdminDashboard() {
  const [adminTab, setAdminTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Security Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);

  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    country: 'US',
    role: 'user'
  });

  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [offset]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.client.get('/auth/admin/users', {
        params: { limit: 10, offset, search: searchQuery }
      });
      setUsers(response.data?.data?.users || []);
      setTotal(response.data?.data?.total || 0);
    } catch (err: any) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.client.get('/auth/admin/stats');
      setStats(response.data?.data?.stats || null);
    } catch (err: any) {
      console.error('Failed to load stats', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.email || !createFormData.password || !createFormData.first_name || !createFormData.last_name) {
      setError('All fields are required');
      return;
    }
    try {
      await api.client.post('/auth/admin/users', createFormData);
      setShowCreateModal(false);
      setCreateFormData({ email: '', password: '', first_name: '', last_name: '', country: 'US', role: 'user' });
      setError('');
      loadUsers();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await api.client.post(`/auth/admin/users/${selectedUserForPassword.id}/reset-password`, {
        newPassword: passwordFormData.newPassword
      });
      setShowPasswordModal(false);
      setPasswordFormData({ newPassword: '', confirmPassword: '' });
      setSelectedUserForPassword(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleBanToggle = async (user: User) => {
    try {
      if (user.is_banned) {
        await api.client.post(`/auth/admin/users/${user.id}/unban`);
      } else {
        await api.client.post(`/auth/admin/users/${user.id}/ban`);
      }
      loadUsers();
      loadStats();
    } catch (err: any) {
      setError('Failed to update ban status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await api.client.delete(`/auth/admin/users/${userId}`);
      loadUsers();
      loadStats();
    } catch (err: any) {
      setError('Failed to delete user');
    }
  };

  useEffect(() => {
    if (adminTab === 'audit') {
      loadAuditLogs();
      loadAuditStats();
    }
  }, [adminTab, auditOffset, filterAction, filterRisk, filterStatus]);

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await api.getAuditLogs({
        limit: 15,
        offset: auditOffset,
        action: filterAction !== 'ALL' ? filterAction : undefined,
        riskLevel: filterRisk !== 'ALL' ? filterRisk : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        search: auditSearch || undefined
      });
      setAuditLogs(res.data?.data?.logs || []);
      setAuditTotal(res.data?.data?.total || 0);
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAuditStats = async () => {
    try {
      const res = await api.getAuditStats();
      setAuditStats(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load audit stats', err);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const response = await api.exportAuditLogs();
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit logs', err);
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Shield size={20} />
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white">Admin Console</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage accounts, user permissions, RBAC security roles, and system infrastructure
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs uppercase tracking-wider px-5 py-3 rounded-xl flex items-center gap-2 shadow-glow"
          >
            <UserPlus size={16} />
            <span>Create New User</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <button
            onClick={() => setAdminTab('users')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              adminTab === 'users'
                ? 'bg-gradient-to-r from-brand-600 to-brand-neon text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Users size={15} />
            <span>User Accounts & RBAC</span>
          </button>
          <button
            onClick={() => { setAdminTab('audit'); loadAuditLogs(); loadAuditStats(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              adminTab === 'audit'
                ? 'bg-gradient-to-r from-brand-600 to-brand-neon text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ShieldAlert size={15} className={adminTab === 'audit' ? 'text-white' : 'text-brand-neon'} />
            <span>Security Audit Logs & Forensics</span>
          </button>
        </div>

        {/* Tab 1: Users Management */}
        {adminTab === 'users' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Users</span>
                  <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    <Users size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-white">{stats?.total_users || total || 0}</p>
                <span className="text-[11px] font-bold text-emerald-400 mt-1 inline-block">+12% this month</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Admins & Staff</span>
                  <div className="p-2.5 rounded-xl bg-brand-neon/10 text-brand-neon border border-brand-neon/20">
                    <Shield size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-white">{stats?.admin_users || 1}</p>
                <span className="text-[11px] font-bold text-slate-400 mt-1 inline-block">Full root privileges</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">New This Week</span>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Activity size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-white">{stats?.new_users_week || 0}</p>
                <span className="text-[11px] font-bold text-emerald-400 mt-1 inline-block">Active registrations</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Banned Accounts</span>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ShieldAlert size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-white">{stats?.banned_users || 0}</p>
                <span className="text-[11px] font-bold text-slate-400 mt-1 inline-block">Security restricted</span>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center justify-between gap-4">
              <form onSubmit={handleSearch} className="w-full sm:w-80 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email or name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-900/90 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </form>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-5 py-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertCircle size={17} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-950/80 border-b border-white/[0.08] text-slate-400 uppercase tracking-widest font-bold">
                    <tr>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Created</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-extrabold text-white">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-[10px] text-slate-500">{user.country || 'Global'}</div>
                          </td>
                          <td className="py-4 px-6 font-mono text-slate-300">{user.email}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              user.role === 'admin'
                                ? 'bg-brand-neon/15 text-brand-neon border border-brand-neon/30'
                                : 'bg-white/10 text-slate-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {user.is_banned ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase">
                                Banned
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setSelectedUserForPassword(user); setShowPasswordModal(true); }}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                                title="Reset Password"
                              >
                                <Key size={14} />
                              </button>
                              <button
                                onClick={() => handleBanToggle(user)}
                                className={`p-2 rounded-xl transition-all ${
                                  user.is_banned 
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' 
                                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white'
                                }`}
                                title={user.is_banned ? 'Unban User' : 'Ban User'}
                              >
                                <Ban size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                title="Delete User"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security Audit Logs & Forensics */}
        {adminTab === 'audit' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Audit Security Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Audit Events</span>
                  <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    <FileText size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-white">{auditStats?.totalLogs || auditTotal || 0}</p>
                <span className="text-[11px] font-bold text-slate-400 mt-1 inline-block">Immutable PostgreSQL log</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Critical / High Alerts</span>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ShieldAlert size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-rose-400">{auditStats?.criticalEvents || 0}</p>
                <span className="text-[11px] font-bold text-rose-400 mt-1 inline-block">Requires active review</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Failed Logins (24h)</span>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Lock size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-amber-400">{auditStats?.failedLogins24h || 0}</p>
                <span className="text-[11px] font-bold text-amber-400 mt-1 inline-block">Rate-limited attempts</span>
              </div>

              <div className="glass-card p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Cluster Sessions</span>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Zap size={18} />
                  </div>
                </div>
                <p className="text-3xl font-black text-emerald-400">{auditStats?.activeSessions || 1}</p>
                <span className="text-[11px] font-bold text-emerald-400 mt-1 inline-block">Tracked in Redis</span>
              </div>
            </div>

            {/* Filter & Action Controls Bar */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadAuditLogs()}
                    placeholder="Search email, IP, action..."
                    className="w-full pl-9 pr-3 py-2 bg-dark-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Risk Level Filter */}
                <select
                  value={filterRisk}
                  onChange={(e) => { setFilterRisk(e.target.value); setAuditOffset(0); }}
                  className="bg-dark-900 border border-white/10 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 font-bold"
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="CRITICAL">🔴 Critical Risk</option>
                  <option value="HIGH">🟠 High Risk</option>
                  <option value="MEDIUM">🟡 Medium Risk</option>
                  <option value="LOW">🟢 Low Risk</option>
                </select>

                {/* Action Filter */}
                <select
                  value={filterAction}
                  onChange={(e) => { setFilterAction(e.target.value); setAuditOffset(0); }}
                  className="bg-dark-900 border border-white/10 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 font-bold"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="LOGIN_SUCCESS">Login Success</option>
                  <option value="LOGIN_FAILED">Login Failed</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="SESSION_REVOKED">Session Revoked</option>
                  <option value="STREAM_LIMIT_EXCEEDED">Stream Limit Exceeded</option>
                  <option value="PASSWORD_CHANGED">Password Changed</option>
                  <option value="USER_BANNED">User Banned</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw size={15} className={auditLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  className="px-4 py-2 rounded-xl bg-brand-neon/15 hover:bg-brand-neon/25 text-brand-neon border border-brand-neon/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Download size={14} />
                  <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-950/80 border-b border-white/[0.08] text-slate-400 uppercase tracking-widest font-bold">
                    <tr>
                      <th className="py-4 px-5">Timestamp</th>
                      <th className="py-4 px-5">Risk Level</th>
                      <th className="py-4 px-5">Action</th>
                      <th className="py-4 px-5">User</th>
                      <th className="py-4 px-5">IP Address</th>
                      <th className="py-4 px-5">Status</th>
                      <th className="py-4 px-5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Querying security audit forensics...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                          No audit log entries matching filters.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const risk = (log.risk_level || 'LOW').toUpperCase();
                        const action = log.action || 'SYSTEM_ACTION';
                        return (
                          <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                risk === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' :
                                risk === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                                risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              }`}>
                                {risk}
                              </span>
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="font-extrabold text-white font-mono text-[11px]">{action}</span>
                            </td>
                            <td className="py-3.5 px-5 text-slate-300">
                              {log.user_email || log.user_id?.slice(0, 8) || 'Anonymous'}
                            </td>
                            <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px]">
                              {log.ip_address || '—'}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                log.status === 'FAILURE' || log.status === 'CRITICAL'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {log.status || 'SUCCESS'}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                onClick={() => setSelectedAuditLog(log)}
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-[11px] transition-all"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Pagination */}
            {auditTotal > 15 && (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span>Showing {auditOffset + 1}–{Math.min(auditOffset + 15, auditTotal)} of {auditTotal} events</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditOffset(Math.max(0, auditOffset - 15))}
                    disabled={auditOffset === 0}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditOffset(auditOffset + 15)}
                    disabled={auditOffset + 15 >= auditTotal}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Details Modal Inspector */}
        {selectedAuditLog && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel max-w-2xl w-full p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-neon border border-brand-neon/30">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-mono">{selectedAuditLog.action}</h3>
                    <p className="text-xs text-slate-400">{new Date(selectedAuditLog.created_at).toUTCString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAuditLog(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Risk Level</span>
                  <p className="font-extrabold text-white mt-0.5">{selectedAuditLog.risk_level || 'LOW'}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Status</span>
                  <p className="font-extrabold text-emerald-400 mt-0.5">{selectedAuditLog.status || 'SUCCESS'}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-900 border border-white/[0.06]">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">IP Address</span>
                  <p className="font-extrabold text-white mt-0.5 font-mono">{selectedAuditLog.ip_address || '—'}</p>
                </div>
              </div>

              {selectedAuditLog.user_agent && (
                <div className="p-3 rounded-xl bg-dark-900 border border-white/[0.06] text-xs">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">User-Agent Header</span>
                  <p className="font-mono text-slate-300 mt-1 break-all text-[11px]">{selectedAuditLog.user_agent}</p>
                </div>
              )}

              {(selectedAuditLog.new_values || selectedAuditLog.old_values) && (
                <div className="p-3 rounded-xl bg-dark-950 border border-white/[0.08] text-xs font-mono">
                  <span className="text-slate-500 uppercase font-bold text-[10px] block mb-1">Payload Forensics Metadata</span>
                  <pre className="text-slate-300 text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedAuditLog.new_values || selectedAuditLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedAuditLog(null)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-white/20 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Create New Account</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 uppercase">First Name</label>
                    <input
                      type="text"
                      required
                      value={createFormData.first_name}
                      onChange={(e) => setCreateFormData({ ...createFormData, first_name: e.target.value })}
                      className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 uppercase">Last Name</label>
                    <input
                      type="text"
                      required
                      value={createFormData.last_name}
                      onChange={(e) => setCreateFormData({ ...createFormData, last_name: e.target.value })}
                      className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase">Email</label>
                  <input
                    type="email"
                    required
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase">Password</label>
                  <input
                    type="password"
                    required
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase">Role</label>
                  <select
                    value={createFormData.role}
                    onChange={(e: any) => setCreateFormData({ ...createFormData, role: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary flex-1 py-3 text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 py-3 text-xs uppercase"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showPasswordModal && selectedUserForPassword && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-white/20 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Reset Password</h3>
                <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Resetting password for <span className="text-white font-bold">{selectedUserForPassword.email}</span>
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 uppercase">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordFormData.newPassword}
                    onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={passwordFormData.confirmPassword}
                    onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-dark-900 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="btn-secondary flex-1 py-3 text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 py-3 text-xs uppercase"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
