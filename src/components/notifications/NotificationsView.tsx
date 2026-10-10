import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem, NotificationType } from '../../types';
import { markNotificationAsRead } from '../../services/notificationService';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Bell,
  CheckCircle,
  Gamepad2,
  Send,
  Landmark,
  HandCoins,
  Check,
  Trophy,
} from 'lucide-react';

interface NotificationsViewProps {
  onNavigate: (tab: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as NotificationItem[];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Notifications snapshot note:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const handleMarkRead = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }
    if (notif.type === 'game' || notif.type === 'payout') {
      onNavigate('game-rooms');
    } else if (notif.type === 'transfer') {
      onNavigate('transactions');
    } else if (notif.type === 'loan') {
      onNavigate('bank-loans');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const item of unread) {
      await updateDoc(doc(db, 'notifications', item.id), { read: true });
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !n.read;
    return n.type === filterType;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'game':
        return <Gamepad2 className="w-4 h-4 text-purple-600" />;
      case 'payout':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'loan':
        return <Landmark className="w-4 h-4 text-emerald-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications & Real-time Alerts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time notifications for games, transfers, loan agreements, and interest updates.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto text-xs pb-1">
        {['all', 'unread', 'game', 'payout', 'transfer', 'loan'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-colors ${
              filterType === f
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading alerts...</div>
        ) : filteredNotifs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No notifications found in this view.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifs.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n)}
                className={`p-4 flex items-start space-x-3 cursor-pointer transition-colors ${
                  n.read ? 'bg-white hover:bg-slate-50/70' : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${n.read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                </div>

                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
