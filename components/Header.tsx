"use client";

import { Search, Bell, Menu, X, UserCheck, AlertTriangle, CheckCheck, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firestore';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc, 
  writeBatch,
  Timestamp
} from 'firebase/firestore';

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

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  
  const pathname = usePathname();
  const router = useRouter();

  // Listen for outside clicks to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current && 
        !bellRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Setup real-time Firestore listener for admin notifications
  useEffect(() => {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', 'admin'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications: NotificationDoc[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as NotificationDoc[];
      
      setNotifications(fetchedNotifications);
    }, (error) => {
      console.error("Error listening to admin notifications:", error);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllAsRead = async () => {
    const unreadDocs = notifications.filter(n => !n.isRead);
    if (unreadDocs.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadDocs.forEach(notification => {
        const docRef = doc(db, 'notifications', notification.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = async (notification: NotificationDoc) => {
    // Close dropdown
    setIsNotificationsOpen(false);

    // Mark as read if unread
    if (!notification.isRead) {
      try {
        const docRef = doc(db, 'notifications', notification.id);
        await updateDoc(docRef, { isRead: true });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Redirect based on type
    if (notification.type === 'request') {
      router.push('/dashboard/users?tab=pending');
    } else if (notification.type === 'dispute') {
      router.push('/dashboard/disputes');
    }
  };

  const formatNotificationTime = (timestamp: NotificationDoc['createdAt']) => {
    if (!timestamp) return '';
    let date: Date;
    if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if ('seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return '';
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMin = Math.floor(diffInMs / 60000);
    const diffInHrs = Math.floor(diffInMin / 60);
    const diffInDays = Math.floor(diffInHrs / 24);

    if (diffInMin < 1) return 'Baru saja';
    if (diffInMin < 60) return `${diffInMin}m yang lalu`;
    if (diffInHrs < 24) return `${diffInHrs}jam yang lalu`;
    if (diffInDays < 7) return `${diffInDays}hari yang lalu`;
    return date.toLocaleDateString('id-ID');
  };

  const getIconForType = (type: NotificationDoc['type']) => {
    switch (type) {
      case 'request':
        return <div className="p-2 bg-primary/10 text-primary rounded-xl"><UserCheck size={18} /></div>;
      case 'dispute':
        return <div className="p-2 bg-status-error/10 text-status-error rounded-xl"><AlertTriangle size={18} /></div>;
      default:
        return <div className="p-2 bg-gray-100 text-gray-500 rounded-xl"><Bell size={18} /></div>;
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="flex justify-between items-center py-4 sm:py-5 mb-4 sm:mb-6 gap-4 relative">
      {/* Mobile Toggle & Search */}
      <div className="flex items-center gap-3 flex-1">
        <button 
          className="lg:hidden p-2 rounded-xl bg-surface shadow-[var(--shadow-soft)] text-text-primary cursor-pointer"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu size={22} />
        </button>
        
        <div className="relative flex items-center w-full max-w-[320px]">
          <Search size={18} strokeWidth={2} className="absolute left-4 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full py-2.5 sm:py-3 pr-4 pl-11 rounded-full border-none bg-surface shadow-[var(--shadow-soft)] focus:shadow-[var(--shadow-hover)] font-inherit text-[13px] sm:text-[14px] outline-none transition-shadow duration-200 placeholder:text-text-tertiary" 
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Notification Bell & Dropdown */}
        <div className="relative">
          <button 
            ref={bellRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-surface shadow-[var(--shadow-soft)] flex items-center justify-center text-text-secondary hover:shadow-[var(--shadow-hover)] transition-all cursor-pointer ${isNotificationsOpen ? 'ring-2 ring-primary/20 bg-background' : ''}`}
          >
            <Bell size={20} strokeWidth={2} className={isNotificationsOpen ? 'text-primary' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-status-error text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Rich Dropdown */}
          {isNotificationsOpen && (
            <div 
              ref={dropdownRef}
              className="absolute right-0 mt-3 w-[340px] sm:w-[380px] bg-white/90 backdrop-blur-md border border-border-color shadow-2xl rounded-[var(--radius-md)] overflow-hidden z-[999] animate-in fade-in slide-in-from-top-5 duration-200 ease-out"
            >
              <div className="p-4 border-b border-border-color flex justify-between items-center bg-white">
                <div>
                  <h3 className="font-bold text-text-primary text-[15px]">Notifikasi</h3>
                  <p className="text-[11px] text-text-secondary">Anda memiliki {unreadCount} pesan belum dibaca</p>
                </div>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
                  >
                    <CheckCheck size={14} /> Semua Dibaca
                  </button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto py-1 bg-background/30">
                {notifications.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center text-text-tertiary gap-2 bg-white">
                    <Bell size={32} className="opacity-20" />
                    <p className="text-[13px] font-medium">Tidak ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`px-4 py-3 border-b border-black/[0.03] hover:bg-accent-green-pale/30 transition-colors flex gap-3 cursor-pointer relative ${!item.isRead ? 'bg-white' : 'bg-white/60'}`}
                    >
                      {!item.isRead && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                      <div className="shrink-0 mt-0.5">
                        {getIconForType(item.type)}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between items-start">
                          <span className={`text-[13px] leading-tight ${!item.isRead ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-text-tertiary whitespace-nowrap ml-2 shrink-0 mt-0.5">
                            <Clock size={10} />
                            {formatNotificationTime(item.createdAt)}
                          </div>
                        </div>
                        <p className={`text-[12px] leading-normal line-clamp-2 ${!item.isRead ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border-color text-center bg-white">
                <button 
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    router.push('/dashboard/notifications');
                  }}
                  className="text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                  Lihat Semua Notifikasi
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-accent-gold text-white flex items-center justify-center font-semibold text-[13px] sm:text-[14px] shadow-[var(--shadow-soft)]">
            <span>AD</span>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.5px]">System Admin</span>
            <span className="text-[13px] sm:text-[14px] font-semibold text-text-primary">Admin SewainAja</span>
          </div>
        </div>
      </div>

      {/* Basic Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-[250px] bg-surface p-6 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-primary text-xl">SewainAja</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="cursor-pointer"><X size={24} /></button>
            </div>
            <nav className="flex flex-col gap-4">
              <Link href="/dashboard" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Dashboard</Link>
              <Link href="/dashboard/users" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard/users') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Users</Link>
              <Link href="/dashboard/disputes" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard/disputes') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Disputes</Link>
              <Link href="/dashboard/notifications" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard/notifications') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Notifications</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
