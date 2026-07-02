'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Eye, Loader2, X, Check, RefreshCw, 
  Wallet, CheckCircle2, XCircle, ArrowUpRight, Calendar
} from 'lucide-react';
import Badge from '@/components/Badge';
import { fetchWithAuth } from '@/lib/api';

interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  createdAt: any;
  processedAt?: any;
  processedBy?: string;
  rejectionReason?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function WithdrawalsManagement() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  
  // Actions states
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetchWithAuth<ApiResponse<Withdrawal[]>>('/admin/withdrawals');
      if (response.success) {
        setWithdrawals(response.data);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWithdrawals(true);
  }, [fetchWithdrawals]);

  const handleApprove = async (id: string) => {
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetchWithAuth<ApiResponse<any>>(`/admin/withdrawals/${id}/approve`, {
        method: 'PATCH'
      });
      if (response.success) {
        setActionSuccess('Permintaan penarikan saldo berhasil disetujui');
        // Update local state
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'approved' } : w));
        // Close modal after short delay
        setTimeout(() => {
          setSelectedWithdrawal(null);
          setActionSuccess(null);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      setActionError(error.message || 'Gagal menyetujui penarikan saldo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      setActionError('Alasan penolakan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetchWithAuth<ApiResponse<any>>(`/admin/withdrawals/${id}/reject`, {
        method: 'PATCH',
        body: { rejectionReason }
      });
      if (response.success) {
        setActionSuccess('Permintaan penarikan saldo berhasil ditolak');
        // Update local state
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected', rejectionReason } : w));
        // Close modal and reset state after short delay
        setTimeout(() => {
          setSelectedWithdrawal(null);
          setIsRejectMode(false);
          setRejectionReason('');
          setActionSuccess(null);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      setActionError(error.message || 'Gagal menolak penarikan saldo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter and Search logic
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(item => {
      const matchesSearch = 
        item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.accountNumber.includes(searchQuery);

      if (activeTab === 'pending') {
        return matchesSearch && item.status === 'pending';
      }
      return matchesSearch;
    });
  }, [withdrawals, searchQuery, activeTab]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    let date: Date;
    if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Wallet className="text-primary" />
            Manajemen Penarikan Saldo
          </h1>
          <p className="text-sm text-text-tertiary">
            Kelola dan konfirmasi pencairan saldo dari virtual wallet para pengguna.
          </p>
        </div>
        <button
          onClick={() => void fetchWithdrawals(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#012d1d] hover:bg-primary/5 rounded-full border border-border-color transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-surface p-3 rounded-2xl border border-border-color/30 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'pending'
                ? 'bg-primary text-white shadow-md'
                : 'text-text-tertiary hover:bg-background'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-md'
                : 'text-text-tertiary hover:bg-background'
            }`}
          >
            Semua Riwayat
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Cari nama, email, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border-color focus:border-primary focus:ring-1 focus:ring-primary outline-none transition bg-background text-text-primary"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface rounded-2xl border border-border-color/30 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-primary" size={36} />
            <p className="text-sm text-text-tertiary">Memuat data pengajuan penarikan...</p>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Wallet size={48} className="text-text-tertiary/40 mb-3" />
            <h3 className="font-semibold text-text-primary">Tidak ada pengajuan ditemukan</h3>
            <p className="text-sm text-text-tertiary mt-1 max-w-xs">
              Belum ada permintaan penarikan saldo {activeTab === 'pending' ? 'yang berstatus pending' : ''} saat ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-color bg-background/50">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary">Pengaju</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary">Rekening Tujuan</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary">Nominal</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary">Tanggal Pengajuan</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary">Status</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-tertiary text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {filteredWithdrawals.map((item) => (
                  <tr key={item.id} className="hover:bg-background/40 transition">
                    <td className="p-4">
                      <div>
                        <div className="font-semibold text-text-primary">{item.userName}</div>
                        <div className="text-xs text-text-tertiary">{item.userEmail}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-text-primary">{item.bankName}</div>
                        <div className="text-xs text-text-tertiary font-mono">{item.accountNumber}</div>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-[#012d1d]">{formatRupiah(item.amount)}</td>
                    <td className="p-4 text-sm text-text-secondary">{formatDate(item.createdAt)}</td>
                    <td className="p-4">
                      <Badge 
                        status={
                          item.status === 'pending' ? 'pending' : 
                          item.status === 'approved' ? 'success' : 'error'
                        } 
                        label={
                          item.status === 'pending' ? 'Diproses' : 
                          item.status === 'approved' ? 'Disetujui' : 'Ditolak'
                        } 
                      />
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedWithdrawal(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border-color hover:bg-primary hover:text-white transition"
                      >
                        <Eye size={14} />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-border-color/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-color flex justify-between items-center bg-background/50">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <Wallet size={20} />
                Detail Penarikan Saldo
              </h2>
              <button 
                onClick={() => {
                  setSelectedWithdrawal(null);
                  setIsRejectMode(false);
                  setActionError(null);
                  setRejectionReason('');
                }}
                className="p-1 rounded-lg hover:bg-background text-text-tertiary transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Alert Feedback */}
              {actionError && (
                <div className="p-3.5 bg-status-error/10 border border-status-error/20 rounded-xl text-status-error text-sm flex items-start gap-2.5">
                  <XCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}
              {actionSuccess && (
                <div className="p-3.5 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-sm flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 bg-background/60 p-4 rounded-2xl border border-border-color">
                <div>
                  <div className="text-xs text-text-tertiary">Nama Pengguna</div>
                  <div className="font-semibold text-text-primary text-sm mt-0.5">{selectedWithdrawal.userName}</div>
                </div>
                <div>
                  <div className="text-xs text-text-tertiary">Email Pengguna</div>
                  <div className="font-semibold text-text-primary text-sm mt-0.5">{selectedWithdrawal.userEmail}</div>
                </div>
                <div className="col-span-2 border-t border-border-color/60 my-1"></div>
                <div>
                  <div className="text-xs text-text-tertiary">Bank / E-Wallet</div>
                  <div className="font-semibold text-text-primary text-sm mt-0.5">{selectedWithdrawal.bankName}</div>
                </div>
                <div>
                  <div className="text-xs text-text-tertiary">Nomor Rekening / HP</div>
                  <div className="font-semibold text-text-primary text-sm font-mono mt-0.5">{selectedWithdrawal.accountNumber}</div>
                </div>
                <div className="col-span-2 border-t border-border-color/60 my-1"></div>
                <div>
                  <div className="text-xs text-text-tertiary">Tanggal Pengajuan</div>
                  <div className="font-medium text-text-secondary text-sm mt-0.5 flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(selectedWithdrawal.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-tertiary">Nominal Penarikan</div>
                  <div className="font-extrabold text-primary text-base mt-0.5">{formatRupiah(selectedWithdrawal.amount)}</div>
                </div>
              </div>

              {/* Status and Notes */}
              <div>
                <div className="text-sm font-semibold text-text-primary mb-2">Status Pengajuan</div>
                <div className="flex items-center gap-3">
                  <Badge 
                    status={
                      selectedWithdrawal.status === 'pending' ? 'pending' : 
                      selectedWithdrawal.status === 'approved' ? 'success' : 'error'
                    } 
                    label={
                      selectedWithdrawal.status === 'pending' ? 'Menunggu Konfirmasi' : 
                      selectedWithdrawal.status === 'approved' ? 'Dana Berhasil Ditransfer' : 'Pengajuan Ditolak'
                    } 
                  />
                </div>
              </div>

              {selectedWithdrawal.status === 'rejected' && selectedWithdrawal.rejectionReason && (
                <div className="p-4 bg-status-error/5 border border-status-error/10 rounded-2xl">
                  <div className="text-xs font-bold text-status-error uppercase tracking-wide">Alasan Penolakan Admin:</div>
                  <p className="text-sm text-text-secondary mt-1">{selectedWithdrawal.rejectionReason}</p>
                </div>
              )}

              {/* Reject Reason input if reject mode active */}
              {isRejectMode && selectedWithdrawal.status === 'pending' && (
                <div className="space-y-2 animate-slide-up">
                  <label className="block text-sm font-semibold text-text-primary">
                    Alasan Penolakan
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Masukkan alasan mengapa permintaan penarikan ini ditolak..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-border-color focus:border-status-error focus:ring-1 focus:ring-status-error outline-none transition bg-background text-text-primary"
                  />
                  <p className="text-xs text-status-error">
                    *Dana akan otomatis dikembalikan (refund) penuh ke virtual wallet pengguna setelah penolakan dikonfirmasi.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-border-color bg-background/50 flex justify-end gap-3">
              {selectedWithdrawal.status === 'pending' ? (
                <>
                  {isRejectMode ? (
                    <>
                      <button
                        onClick={() => {
                          setIsRejectMode(false);
                          setRejectionReason('');
                          setActionError(null);
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-border-color hover:bg-background transition"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleReject(selectedWithdrawal.id)}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-status-error text-white hover:bg-status-error/90 transition flex items-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                        Konfirmasi Tolak & Refund
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsRejectMode(true)}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#b42318] text-[#b42318] hover:bg-status-error/5 transition"
                      >
                        Tolak Request
                      </button>
                      <button
                        onClick={() => handleApprove(selectedWithdrawal.id)}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#1b7f4c] text-white hover:bg-[#1b7f4c]/90 transition flex items-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        Setujui & Tandai Ditransfer
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setSelectedWithdrawal(null);
                    setIsRejectMode(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/95 transition"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
