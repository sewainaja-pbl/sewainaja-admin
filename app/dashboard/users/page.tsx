'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Search, CheckCircle2, XCircle, Eye, ShieldAlert, Loader2, Check, X, ExternalLink } from 'lucide-react';
import { db } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, limit as firestoreLimit, Timestamp } from 'firebase/firestore';
import Badge from '@/components/Badge';
import { fetchWithAuth } from '@/lib/api';

type FirestoreTimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

interface UserDoc {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  isOwner?: boolean;
  isRenter?: boolean;
  isAdmin?: boolean;
  status: 'pending' | 'verified' | 'suspended';
  ktpPhotoUrl?: string;
  selfiePhotoUrl?: string;
  createdAt?: Timestamp | FirestoreTimestampLike | string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: { message?: string };
}

export default function UsersManagement() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'pending') {
      setActiveTab('pending');
    } else if (tab === 'all') {
      setActiveTab('all');
    }
  }, [searchParams]);
  
  // State for modal / reviewing user
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const fetchUsers = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);

    try {
      if (activeTab === 'pending') {
        // Fetch via Cloud Functions API
        const response = await fetchWithAuth<ApiResponse<UserDoc[]>>('/admin/users/pending');
        // API response has standard { success, data, message } format
        if (response.success) {
          setUsers(response.data);
        }
      } else {
        // Fetch all users directly from Firestore
        const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), firestoreLimit(50));
        const snapshot = await getDocs(usersQuery);
        const userList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserDoc[];
        setUsers(userList);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  const handleStatusUpdate = async (userId: string, action: 'approve' | 'reject') => {
    setUpdatingUserId(userId);
    setActionError(null);
    try {
      const response = await fetchWithAuth<ApiResponse<unknown>>(`/admin/users/${userId}/${action}`, {
        method: 'PATCH'
      });
      
      if (response.success) {
        // Update local state
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return { ...u, status: action === 'approve' ? 'verified' : 'suspended' };
          }
          return u;
        }));
        // If we're in pending tab, remove it
        if (activeTab === 'pending') {
          setUsers(prev => prev.filter(u => u.id !== userId));
        }
        
        // Close modal if this was the user in modal
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(null);
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to ${action} user:`, error);
      setActionError(getErrorMessage(error, 'Failed to perform action'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleBadge = (user: UserDoc) => {
    if (user.isAdmin) return 'Admin';
    if (user.isOwner && user.isRenter) return 'Owner + Renter';
    if (user.isOwner) return 'Owner';
    return 'Renter';
  };

  const getStatusBadgeProps = (status: UserDoc['status']) => {
    switch (status) {
      case 'verified': return { status: 'success' as const, label: 'Verified' };
      case 'suspended': return { status: 'error' as const, label: 'Suspended' };
      default: return { status: 'pending' as const, label: 'Pending' };
    }
  };

  const filteredUsers = users.filter(user => 
    (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (timestamp: UserDoc['createdAt']) => {
    if (!timestamp) return '-';
    if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleDateString();
    if (typeof timestamp === 'object' && 'seconds' in timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString();
    }
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleDateString();
    return '-';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Users & Verification</h1>
          <p className="text-[14px] text-text-secondary m-0">Verify user documents and manage account permissions.</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full md:w-[280px] shadow-[var(--shadow-soft)]" 
          />
        </div>
      </div>

      {/* Main Content Box */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col">
        
        {/* Tabs */}
        <div className="px-6 pt-4 border-bottom border-border-color flex items-center justify-between border-b border-black/5">
          <div className="flex gap-6">
            <button 
              onClick={() => {
                setLoading(true);
                setActiveTab('all');
              }}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              All Users
            </button>
            <button 
              onClick={() => {
                setLoading(true);
                setActiveTab('pending');
              }}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] flex items-center gap-2 ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              Pending Approvals
              {activeTab !== 'pending' && users.filter(u => u.status === 'pending').length > 0 && (
                <span className="w-2 h-2 bg-status-error rounded-full"></span>
              )}
            </button>
          </div>
          
          <button onClick={() => void fetchUsers(true)} className="p-2 text-text-tertiary hover:text-primary transition-colors mb-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="text-primary animate-spin" />
                <span className="text-[14px] font-medium text-text-secondary">Fetching users...</span>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Users size={48} className="text-border-color" />
              <p className="font-medium">No users found.</p>
              {searchQuery && <p className="text-[12px]">Try adjusting your search filters.</p>}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">User Profile</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Role</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Registered At</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredUsers.map((user) => {
                  const badgeProps = getStatusBadgeProps(user.status);
                  return (
                    <tr key={user.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-bold border border-primary/20">
                            {getInitials(user.name ?? '')}
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-text-primary m-0">{user.name || 'No Name'}</p>
                            <p className="text-[12px] text-text-secondary m-0">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-text-secondary font-medium">{getRoleBadge(user)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={badgeProps.status} label={badgeProps.label} />
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-tertiary">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {user.status === 'pending' ? (
                            <>
                              <button 
                                onClick={() => setSelectedUser(user)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-full transition-all"
                              >
                                <Eye size={14} /> Review
                              </button>
                              <button 
                                disabled={updatingUserId === user.id}
                                onClick={() => handleStatusUpdate(user.id, 'approve')}
                                className="p-1.5 text-status-success bg-status-success/10 hover:bg-status-success hover:text-white rounded-full transition-all disabled:opacity-50"
                                title="Quick Approve"
                              >
                                {updatingUserId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => setSelectedUser(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-background hover:bg-white border border-border-color rounded-full transition-all"
                            >
                              View Profile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-surface w-full max-w-3xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary flex items-center gap-2">
                  {selectedUser.status === 'pending' ? 'Review Verification Request' : 'User Details'}
                  <Badge {...getStatusBadgeProps(selectedUser.status)} />
                </h2>
                <p className="text-[13px] text-text-secondary mt-1">
                  User ID: <span className="font-mono">{selectedUser.id}</span>
                </p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-background/30">
              {/* Info Column */}
              <div className="space-y-6">
                <div className="bg-surface p-5 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[14px] font-semibold text-text-primary mb-4 border-b pb-2 border-black/5">User Information</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block mb-0.5">Full Name</span>
                      <span className="text-[15px] font-medium text-text-primary">{selectedUser.name}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block mb-0.5">Email Address</span>
                      <span className="text-[14px] text-text-secondary">{selectedUser.email}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block mb-0.5">Phone Number</span>
                      <span className="text-[14px] text-text-secondary">{selectedUser.phone || 'Not provided'}</span>
                    </div>
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <div className="p-2 bg-background border rounded flex items-center justify-between">
                        <span className="text-[12px] font-medium">Renter</span>
                        {selectedUser.isRenter ? <CheckCircle2 size={16} className="text-status-success" /> : <XCircle size={16} className="text-text-tertiary" />}
                      </div>
                      <div className="p-2 bg-background border rounded flex items-center justify-between">
                        <span className="text-[12px] font-medium">Owner</span>
                        {selectedUser.isOwner ? <CheckCircle2 size={16} className="text-status-success" /> : <XCircle size={16} className="text-text-tertiary" />}
                      </div>
                    </div>
                  </div>
                </div>

                {actionError && (
                  <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-[var(--radius-md)] text-status-error text-[13px] flex gap-2">
                    <ShieldAlert size={18} className="shrink-0" />
                    {actionError}
                  </div>
                )}
              </div>

              {/* Document Gallery Column */}
              <div className="space-y-4 flex flex-col h-full">
                <h3 className="text-[14px] font-semibold text-text-primary flex items-center justify-between">
                  Identity Documents
                  <span className="text-[11px] font-normal text-text-tertiary bg-black/5 px-2 py-0.5 rounded">Click to expand</span>
                </h3>
                
                <div className="grid grid-cols-1 gap-4 flex-1">
                  {/* KTP Photo */}
                  <div className="group relative bg-surface rounded-[var(--radius-md)] border border-border-color overflow-hidden aspect-[4/3] shadow-[var(--shadow-soft)]">
                    {selectedUser.ktpPhotoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={selectedUser.ktpPhotoUrl} 
                          alt="KTP Doc" 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <a href={selectedUser.ktpPhotoUrl} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full text-primary shadow-lg">
                            <ExternalLink size={18} />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black/5 text-text-tertiary text-[12px]">
                        <ShieldAlert size={24} className="mb-2 opacity-50" />
                        No KTP image provided
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] font-semibold px-3 py-1.5 backdrop-blur-md">
                      Foto KTP
                    </div>
                  </div>

                  {/* Selfie Photo */}
                  <div className="group relative bg-surface rounded-[var(--radius-md)] border border-border-color overflow-hidden aspect-[4/3] shadow-[var(--shadow-soft)]">
                    {selectedUser.selfiePhotoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={selectedUser.selfiePhotoUrl} 
                          alt="Selfie Verif" 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <a href={selectedUser.selfiePhotoUrl} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full text-primary shadow-lg">
                            <ExternalLink size={18} />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black/5 text-text-tertiary text-[12px]">
                        <ShieldAlert size={24} className="mb-2 opacity-50" />
                        No Selfie image provided
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] font-semibold px-3 py-1.5 backdrop-blur-md">
                      Foto Selfie
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-between items-center">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
              
              {selectedUser.status === 'pending' && (
                <div className="flex gap-3">
                  <button 
                    disabled={!!updatingUserId}
                    onClick={() => handleStatusUpdate(selectedUser.id, 'reject')}
                    className="px-5 py-2.5 rounded-full text-[14px] font-medium border border-status-error/30 text-status-error hover:bg-status-error/5 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {updatingUserId === selectedUser.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Reject User
                  </button>
                  <button 
                    disabled={!!updatingUserId}
                    onClick={() => handleStatusUpdate(selectedUser.id, 'approve')}
                    className="px-6 py-2.5 rounded-full text-[14px] font-medium bg-primary text-white shadow-[0_4px_12px_rgba(1,45,29,0.2)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {updatingUserId === selectedUser.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Approve & Verify
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
