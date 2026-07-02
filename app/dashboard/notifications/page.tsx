'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, CheckCircle, Clock, Trash2, Filter, ExternalLink, UserCheck, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firestore';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  writeBatch, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import Badge from '@/components/Badge';

interface NotificationDoc {
  id: string;
  userId: string;
  type: 'request' | 'dispute' | string;
  title: string;
  body: string;
  isRead: boolean;
  transactionId: string | null;
  createdAt: Timestamp | { seconds: number } | null;
}

export default function NotificationsLog() {
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'request' | 'dispute'>('all');
  const router = useRouter();

  useEffect(() => {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', 'admin'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: NotificationDoc[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as NotificationDoc[];
      
      setNotifications(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading all notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error("Failed to update read status:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(notif => {
        const docRef = doc(db, 'notifications', notif.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const docRef = doc(db, 'notifications', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleRowClick = async (item: NotificationDoc) => {
    await handleMarkRead(item.id, item.isRead);

    if (item.type === 'request') {
      router.push('/dashboard/users?tab=pending');
    } else if (item.type === 'dispute') {
      router.push('/dashboard/disputes');
    }
  };

  const formatDateTime = (timestamp: NotificationDoc['createdAt']) => {
    if (!timestamp) return '-';
    let date: Date;
    if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if ('seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return '-';
    }

    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIconForType = (type: NotificationDoc['type']) => {
    switch (type) {
      case 'request':
        return <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20"><UserCheck size={20} /></div>;
      case 'dispute':
        return <div className="p-2.5 bg-status-error/10 text-status-error rounded-2xl border border-status-error/20"><AlertTriangle size={20} /></div>;
      default:
        return <div className="p-2.5 bg-gray-100 text-gray-500 rounded-2xl border border-gray-200"><Bell size={20} /></div>;
    }
  };

  const filteredNotifications = notifications.filter(item => {
    // Filter tab
    if (filterTab === 'unread' && item.isRead) return false;
    if (filterTab === 'request' && item.type !== 'request') return false;
    if (filterTab === 'dispute' && item.type !== 'dispute') return false;

    // Search query
    const searchLower = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(searchLower) ||
      item.body.toLowerCase().includes(searchLower)
    );
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Notification History</h1>
          <p className="text-[14px] text-text-secondary m-0">Review the comprehensive log of system notifications and audit updates.</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Cari notifikasi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full md:w-[280px] shadow-[var(--shadow-soft)]" 
          />
        </div>
      </div>

      {/* Main Box */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Tabs & Quick Actions */}
        <div className="px-6 pt-4 border-b border-black/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button 
              onClick={() => setFilterTab('all')}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] whitespace-nowrap cursor-pointer ${filterTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              Semua ({notifications.length})
            </button>
            <button 
              onClick={() => setFilterTab('unread')}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] whitespace-nowrap flex items-center gap-2 cursor-pointer ${filterTab === 'unread' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              Belum Dibaca
              {unreadCount > 0 && (
                <span className="bg-status-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setFilterTab('request')}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] whitespace-nowrap cursor-pointer ${filterTab === 'request' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              Request Verifikasi
            </button>
            <button 
              onClick={() => setFilterTab('dispute')}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] whitespace-nowrap cursor-pointer ${filterTab === 'dispute' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              Sengketa/Dispute
            </button>
          </div>

          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="mb-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all cursor-pointer"
            >
              <CheckCircle size={14} /> Semua Dibaca
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-background/10">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-secondary py-20">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <p className="text-[14px] font-medium">Memuat data...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-tertiary py-20">
              <Bell size={48} className="opacity-20 mb-2" />
              <p className="text-[15px] font-medium text-text-secondary">Tidak ada notifikasi ditemukan</p>
              {searchQuery && <p className="text-[12px]">Coba sesuaikan filter atau kata kunci pencarian Anda.</p>}
            </div>
          ) : (
            <div className="divide-y divide-black/[0.03]">
              {filteredNotifications.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className={`px-6 py-4 transition-all flex items-start gap-4 cursor-pointer group relative ${!item.isRead ? 'bg-white shadow-[inset_3px_0_0_0_var(--color-primary)]' : 'bg-transparent hover:bg-white/60'}`}
                >
                  <div className="shrink-0 mt-1">
                    {getIconForType(item.type)}
                  </div>
                  
                  <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <h4 className={`text-[14px] leading-tight truncate ${!item.isRead ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                          {item.title}
                        </h4>
                        {!item.isRead && (
                          <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Baru</span>
                        )}
                      </div>
                      <p className={`text-[13px] leading-relaxed break-words ${!item.isRead ? 'text-text-secondary font-medium' : 'text-text-tertiary'}`}>
                        {item.body}
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col md:items-end items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
                        <Clock size={13} />
                        {formatDateTime(item.createdAt)}
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleDeleteNotification(item.id, e)}
                          className="p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded-full transition-all cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button 
                          className="p-1.5 text-text-tertiary hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                          title="Kunjungi Halaman"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
