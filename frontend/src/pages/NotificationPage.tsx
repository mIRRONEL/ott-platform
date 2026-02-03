import React, { useState, useEffect } from 'react';
import { Bell, Trash2, Check } from 'lucide-react';
import api from '../services/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.getNotifications(filter === 'unread' ? false : undefined);
      setNotifications(response?.data?.data || []);
    } catch (err) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationAsRead(notificationId);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await api.deleteNotification(notificationId);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete notification');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/20 border-green-500 text-green-300';
      case 'error':
        return 'bg-red-900/20 border-red-500 text-red-300';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-500 text-yellow-300';
      default:
        return 'bg-blue-900/20 border-blue-500 text-blue-300';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={32} className="text-yellow-500" />
            <h1 className="text-4xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="ml-auto px-3 py-1 bg-red-600 rounded-full text-sm font-semibold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-slate-400">Stay updated with your activity and system notifications</p>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'unread'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Unread
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading notifications...</div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border-l-4 transition-all ${getTypeColor(
                  notification.type
                )} ${!notification.read ? 'bg-slate-800/80' : 'bg-slate-800/40'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{notification.title}</h3>
                    <p className="text-sm opacity-90">{notification.message}</p>
                    <p className="text-xs opacity-60 mt-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
