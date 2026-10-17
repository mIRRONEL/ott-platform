import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Trash2, 
  Check, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  Inbox,
  Sparkles,
  CheckCheck,
  Filter,
  Layers,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

interface Notification {
  id: string;
  _id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY_READ = 'ott_read_notifications';
const STORAGE_KEY_DELETED = 'ott_deleted_notifications';

const getStoredIds = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveStoredIds = (key: string, ids: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {}
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const showToast = (text: string, type: 'success' | 'warn' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const readSet = getStoredIds(STORAGE_KEY_READ);
      const deletedSet = getStoredIds(STORAGE_KEY_DELETED);

      let items: Notification[] = [];
      try {
        const response = await api.getNotifications(filter === 'unread' ? false : undefined);
        const data = Array.isArray(response.data) 
          ? response.data 
          : response.data?.data || [];
        if (Array.isArray(data)) items = data;
      } catch (e) {
        console.warn('Backend notifications query notice:', e);
      }

      // Apply deleted filter and read state from both DB & localStorage
      const filtered = items
        .filter(item => {
          const id = item.id || item._id || '';
          return id && !deletedSet.has(id);
        })
        .map(item => {
          const id = item.id || item._id || '';
          const isRead = Boolean(item.read || readSet.has(id));
          return { ...item, id, read: isRead };
        });

      setNotifications(filter === 'unread' ? filtered.filter(n => !n.read) : filtered);
    } catch (err: any) {
      console.warn('Notifications loaded:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const readSet = getStoredIds(STORAGE_KEY_READ);
    readSet.add(notificationId);
    saveStoredIds(STORAGE_KEY_READ, readSet);

    setNotifications(prev => prev.map(item => 
      (item.id === notificationId || item._id === notificationId) 
        ? { ...item, read: true } 
        : item
    ));
    showToast('Notification acknowledged');
    window.dispatchEvent(new Event('ott_notifications_updated'));

    try {
      await api.markNotificationAsRead(notificationId);
    } catch (err: any) {
      console.warn('Backend markAsRead notice:', err?.message || err);
    }
  };

  const markAllAsRead = async () => {
    const readSet = getStoredIds(STORAGE_KEY_READ);
    notifications.forEach(n => {
      if (n.id) readSet.add(n.id);
      if (n._id) readSet.add(n._id);
    });
    saveStoredIds(STORAGE_KEY_READ, readSet);

    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    showToast('All notifications marked as read');
    window.dispatchEvent(new Event('ott_notifications_updated'));

    try {
      await api.client.put('/notifications/read-all');
    } catch (err: any) {
      console.warn('Backend markAllAsRead notice:', err?.message || err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const deletedSet = getStoredIds(STORAGE_KEY_DELETED);
    deletedSet.add(notificationId);
    saveStoredIds(STORAGE_KEY_DELETED, deletedSet);

    setNotifications(prev => prev.filter(item => item.id !== notificationId && item._id !== notificationId));
    showToast('Notification deleted');
    window.dispatchEvent(new Event('ott_notifications_updated'));

    try {
      await api.deleteNotification(notificationId);
    } catch (err: any) {
      console.warn('Backend deleteNotification notice:', err?.message || err);
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    const deletedSet = getStoredIds(STORAGE_KEY_DELETED);
    notifications.forEach(n => {
      if (n.id) deletedSet.add(n.id);
      if (n._id) deletedSet.add(n._id);
    });
    saveStoredIds(STORAGE_KEY_DELETED, deletedSet);

    setNotifications([]);
    showToast('All notifications cleared');
    window.dispatchEvent(new Event('ott_notifications_updated'));

    try {
      await api.client.delete('/notifications/clear-all');
    } catch (err: any) {
      console.warn('Backend clearAllNotifications notice:', err?.message || err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-400 shrink-0" size={20} />;
      case 'error': return <XCircle className="text-rose-500 shrink-0" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-400 shrink-0" size={20} />;
      default: return <Info className="text-brand-400 shrink-0" size={20} />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 lg:p-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-300 ${
          toastMessage.type === 'warn' ? 'bg-amber-500 text-dark-950 font-bold' : 'bg-emerald-500 text-white font-bold'
        }`}>
          {toastMessage.type === 'warn' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span className="text-sm">{toastMessage.text}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-glow">
                <Bell size={22} />
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-brand-neon/20 border border-brand-neon/40 text-brand-neon text-xs font-black">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Real-time transcoding statuses, VIP receipts, and system alerts
            </p>
          </div>

          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Mark all as read"
                  >
                    <CheckCheck size={15} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={clearAllNotifications}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Clear all notifications"
                >
                  <Trash2 size={15} />
                  <span>Clear all</span>
                </button>
              </>
            )}

            <div className="flex items-center gap-1.5 bg-dark-900/80 p-1 rounded-2xl border border-white/[0.06]">
              <button
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === 'all'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-neon text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === 'unread'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-neon text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unread
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="text-center py-20 text-slate-500">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold">Synchronizing notifications from datastore...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 glass-card p-8 rounded-3xl">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-3 text-brand-400">
                <Inbox size={30} />
              </div>
              <p className="text-sm font-extrabold text-white">You're all caught up!</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No new notifications in your inbox. When new videos finish transcoding or subscription updates occur, you will see them here.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const notifId = item.id || item._id || '';
              return (
                <div
                  key={notifId}
                  className={`glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
                    !item.read 
                      ? 'border-brand-500/40 bg-dark-900/90 shadow-lg shadow-brand-950/40' 
                      : 'opacity-70 hover:opacity-100 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2.5 rounded-2xl border ${
                      !item.read ? 'bg-dark-950 border-brand-500/30' : 'bg-dark-950/60 border-white/[0.06]'
                    }`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-sm">{item.title}</h3>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>
                      <span className="text-[10px] text-slate-500 font-semibold block pt-0.5">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                    {!item.read && (
                      <button
                        onClick={() => markAsRead(notifId)}
                        className="px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-300 hover:text-white border border-brand-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Acknowledge / Mark as Read"
                      >
                        <Check size={14} />
                        <span>Acknowledge</span>
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notifId)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all"
                      title="Delete Notification"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
