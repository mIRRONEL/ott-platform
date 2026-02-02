import React, { useState, useEffect } from 'react';
import { Trash2, Ban, Shield, Search, ChevronLeft, Plus, Key, X } from 'lucide-react';
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
}

interface Stats {
  total_users: number;
  banned_users: number;
  admin_users: number;
  new_users_week: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);

  // Form states
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
      setUsers(response.data.data.users);
      setTotal(response.data.data.total);
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
      setStats(response.data.data.stats);
    } catch (err: any) {
      console.error('Failed to load stats', err);
    }
  };

  const handleSearch = async () => {
    setOffset(0);
    loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.email || !createFormData.password || !createFormData.first_name || !createFormData.last_name) {
      setError('All fields are required');
      return;
    }

    if (createFormData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await api.client.post('/auth/admin/users', createFormData);
      setShowCreateModal(false);
      setCreateFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        country: 'US',
        role: 'user'
      });
      setError('');
      loadUsers();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordFormData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await api.client.post(`/auth/admin/users/${selectedUserForPassword?.id}/reset-password`, {
        newPassword: passwordFormData.newPassword
      });
      setShowPasswordModal(false);
      setPasswordFormData({ newPassword: '', confirmPassword: '' });
      setSelectedUserForPassword(null);
      setError('');
      alert('Password reset successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    if (!window.confirm(`Are you sure you want to ${isBanned ? 'ban' : 'unban'} this user?`)) return;

    try {
      await api.client.put(`/auth/admin/users/${userId}/ban`, {
        is_banned: isBanned
      });
      loadUsers();
      setError('');
    } catch (err: any) {
      setError('Failed to ban user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
      await api.client.delete(`/auth/admin/users/${userId}`);
      loadUsers();
      setError('');
    } catch (err: any) {
      setError('Failed to delete user');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await api.client.put(`/auth/admin/users/${userId}/role`, {
        role: newRole
      });
      loadUsers();
      setError('');
    } catch (err: any) {
      setError('Failed to change user role');
    }
  };

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition"
          >
            <ChevronLeft size={20} /> Back to Users
          </button>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6">{selectedUser.first_name} {selectedUser.last_name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm">Email</label>
                <p className="text-white font-mono">{selectedUser.email}</p>
              </div>

              <div>
                <label className="text-slate-400 text-sm">Role</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => {
                    handleChangeRole(selectedUser.id, e.target.value);
                    setSelectedUser({ ...selectedUser, role: e.target.value as any });
                  }}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500"
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-sm">Joined</label>
                <p className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>

              {selectedUser.last_login && (
                <div>
                  <label className="text-slate-400 text-sm">Last Login</label>
                  <p className="text-white">{new Date(selectedUser.last_login).toLocaleDateString()}</p>
                </div>
              )}

              <div className="pt-6 border-t border-slate-700 flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedUserForPassword(selectedUser);
                    setShowPasswordModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded transition"
                >
                  <Key size={16} />
                  Reset Password
                </button>

                <button
                  onClick={() => handleBanUser(selectedUser.id, !selectedUser.is_banned)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                    selectedUser.is_banned
                      ? 'bg-green-900 hover:bg-green-800 text-green-100'
                      : 'bg-red-900 hover:bg-red-800 text-red-100'
                  }`}
                >
                  <Ban size={16} />
                  {selectedUser.is_banned ? 'Unban User' : 'Ban User'}
                </button>

                <button
                  onClick={() => handleDeleteUser(selectedUser.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded transition ml-auto"
                >
                  <Trash2 size={16} />
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            <Plus size={20} />
            Create User
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <label className="text-slate-400 text-sm">Total Users</label>
              <p className="text-3xl font-bold text-white">{stats.total_users}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <label className="text-slate-400 text-sm">New Users (7 days)</label>
              <p className="text-3xl font-bold text-indigo-400">{stats.new_users_week}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <label className="text-slate-400 text-sm">Admin Users</label>
              <p className="text-3xl font-bold text-blue-400">{stats.admin_users}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <label className="text-slate-400 text-sm">Banned Users</label>
              <p className="text-3xl font-bold text-red-400">{stats.banned_users}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full px-6 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-indigo-500 outline-none text-white pl-12"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            Search
          </button>
        </div>

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && <p className="text-slate-400">Loading users...</p>}

        {/* Users Table */}
        {!loading && users.length > 0 && (
          <>
            <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700 transition">
                      <td className="px-6 py-4 text-sm font-mono text-slate-300">{user.email}</td>
                      <td className="px-6 py-4 text-sm">{user.first_name} {user.last_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          className="bg-slate-700 text-white px-2 py-1 rounded text-xs border border-slate-600 focus:border-indigo-500"
                        >
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          user.is_banned
                            ? 'bg-red-900 text-red-100'
                            : 'bg-green-900 text-green-100'
                        }`}>
                          {user.is_banned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-indigo-400 hover:text-indigo-300 transition"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserForPassword(user);
                            setShowPasswordModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => handleBanUser(user.id, !user.is_banned)}
                          className="text-orange-400 hover:text-orange-300 transition"
                        >
                          {user.is_banned ? 'Unban' : 'Ban'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-slate-400">
                Showing {offset + 1} - {Math.min(offset + 10, total)} of {total} users
              </p>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 10))}
                  className="px-4 py-2 bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-white rounded transition"
                >
                  Previous
                </button>
                <button
                  disabled={offset + 10 >= total}
                  onClick={() => setOffset(offset + 10)}
                  className="px-4 py-2 bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-white rounded transition"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {!loading && users.length === 0 && (
          <p className="text-slate-400">No users found</p>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="text-slate-300 text-sm">Email</label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm">First Name</label>
                <input
                  type="text"
                  value={createFormData.first_name}
                  onChange={(e) => setCreateFormData({ ...createFormData, first_name: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm">Last Name</label>
                <input
                  type="text"
                  value={createFormData.last_name}
                  onChange={(e) => setCreateFormData({ ...createFormData, last_name: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm">Password</label>
                <input
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm">Role</label>
                <select
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded transition"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUserForPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedUserForPassword(null);
                  setPasswordFormData({ newPassword: '', confirmPassword: '' });
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-slate-300 text-sm">Resetting password for: <strong>{selectedUserForPassword.email}</strong></p>

              <div>
                <label className="text-slate-300 text-sm">New Password</label>
                <input
                  type="password"
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm">Confirm Password</label>
                <input
                  type="password"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedUserForPassword(null);
                    setPasswordFormData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
