'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Eye, Loader2, X, AlertOctagon, ShieldAlert,
  ChevronLeft, ChevronRight, AlertTriangle, Check, UserX, PackageMinus, RefreshCw
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import Badge from '@/components/Badge';
import { fetchWithAuth } from '@/lib/api';

type FirestoreTimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

interface ReportDoc {
  id: string;
  reporterId: string;
  reportedId: string;
  itemId?: string;
  itemName?: string;
  type: 'fraud' | 'harassment' | 'bad_item' | 'other' | string;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | string;
  createdAt: Timestamp | FirestoreTimestampLike | string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function ReportsManagement() {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 10;

  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { user } = useAuth();

  const fetchReports = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const q = query(collection(db, 'user_reports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReportDoc[];
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const reportRef = doc(db, 'user_reports', reportId);
      await updateDoc(reportRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => prev ? { ...prev, status: newStatus } : null);
      }
      setActionSuccess(`Status laporan berhasil diubah menjadi ${newStatus}.`);
    } catch (error) {
      console.error('Error updating report status:', error);
      setActionError('Gagal mengubah status laporan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlockItem = async (itemId: string, itemName: string) => {
    if (!user || !itemId || itemId === 'local_or_dummy_item') {
      setActionError('Item ID tidak valid untuk diblokir.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const itemRef = doc(db, 'items', itemId);
      await updateDoc(itemRef, {
        status: 'blocked',
        blockedReason: `Dilaporkan oleh user. Tindakan admin dari Laporan.`,
        blockedBy: user.uid,
        blockedAt: serverTimestamp()
      });

      setActionSuccess(`Barang "${itemName}" berhasil diblokir.`);
      
      // Auto-resolve report if user chooses to
      if (selectedReport) {
        await handleUpdateStatus(selectedReport.id, 'resolved');
      }
    } catch (error) {
      console.error('Error blocking item:', error);
      setActionError('Gagal memblokir barang. Pastikan item ID valid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!userId) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetchWithAuth<ApiResponse<unknown>>(`/admin/users/${userId}/reject`, {
        method: 'PATCH'
      });
      
      if (response.success) {
        setActionSuccess(`User ID ${userId} berhasil disuspensi.`);
        // Auto-resolve report
        if (selectedReport) {
          await handleUpdateStatus(selectedReport.id, 'resolved');
        }
      } else {
        setActionError('Gagal menyuspensi user via API.');
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      setActionError('Terjadi kesalahan saat menghubungi API untuk menyuspensi user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeProps = (status: string): { status: 'active' | 'pending' | 'success' | 'error' | 'unverified'; label: string } => {
    switch (status) {
      case 'resolved': return { status: 'success', label: 'Resolved' };
      case 'investigating': return { status: 'pending', label: 'Investigating' };
      case 'pending': return { status: 'error', label: 'Pending' };
      default: return { status: 'unverified', label: status || 'Unknown' };
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'bad_item': return 'Barang Tidak Sesuai / Rusak';
      case 'fraud': return 'Penipuan';
      case 'harassment': return 'Pelecehan / Perilaku Buruk';
      case 'other': return 'Lainnya';
      default: return type;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleString('id-ID');
    if (typeof timestamp === 'object' && 'seconds' in timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000).toLocaleString('id-ID');
    }
    if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString('id-ID');
    }
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString('id-ID');
    return '-';
  };

  const processedReports = useMemo(() => {
    let result = [...reports];

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.id.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        r.reporterId.toLowerCase().includes(q) ||
        r.reportedId.toLowerCase().includes(q) ||
        (r.itemName || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [reports, searchQuery, statusFilter, typeFilter]);

  const totalPages = Math.ceil(processedReports.length / reportsPerPage);
  const currentReports = processedReports.slice((currentPage - 1) * reportsPerPage, currentPage * reportsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">User Reports</h1>
          <p className="text-[14px] text-text-secondary m-0">Pantau dan kelola laporan dari pengguna terkait penipuan, pelanggaran barang, atau perilaku menyimpang.</p>
        </div>
        <button
          onClick={() => void fetchReports(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] font-medium text-text-primary hover:border-primary hover:text-primary transition-all shadow-[var(--shadow-soft)]"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Filters & Search Box */}
      <div className="bg-surface rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-soft)] border border-border-color flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-auto flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Cari ID laporan, alasan, reporter, pelaku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div className="flex w-full md:w-auto gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">Semua Kategori</option>
            <option value="bad_item">Barang Tidak Sesuai</option>
            <option value="fraud">Penipuan</option>
            <option value="harassment">Pelecehan</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border-color flex items-center justify-between bg-black/5">
          <span className="text-[13px] font-medium text-text-secondary">
            Menampilkan {currentReports.length} dari {processedReports.length} laporan
          </span>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : currentReports.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <AlertOctagon size={48} className="text-border-color" />
              <p className="font-medium">Tidak ada laporan ditemukan.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Laporan ID</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Pelapor</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Dilaporkan</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Barang</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kategori</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Alasan</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Tanggal</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {currentReports.map((report) => {
                  const badgeProps = getStatusBadgeProps(report.status);
                  return (
                    <tr key={report.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                      <td className="px-6 py-4 font-mono text-[13px] text-text-primary">
                        {report.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 font-mono text-[12px] text-text-secondary">
                        {report.reporterId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 font-mono text-[12px] text-text-secondary">
                        {report.reportedId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-medium text-text-primary">{report.itemName || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-medium text-text-primary">{getTypeLabel(report.type)}</span>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate">
                        <span className="text-[13px] text-text-secondary">{report.reason}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={badgeProps.status} label={badgeProps.label} />
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-tertiary">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setActionError(null);
                            setActionSuccess(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-full transition-all"
                        >
                          <Eye size={14} /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border-color flex items-center justify-between bg-background">
            <span className="text-[13px] text-text-secondary">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full border border-border-color text-text-secondary hover:bg-surface hover:text-primary disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-full border border-border-color text-text-secondary hover:bg-surface hover:text-primary disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-surface w-full max-w-2xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary flex items-center gap-3">
                  Detail Laporan
                  <Badge {...getStatusBadgeProps(selectedReport.status)} />
                </h2>
                <p className="text-[13px] text-text-secondary mt-1">
                  ID Laporan: <span className="font-mono">{selectedReport.id}</span> • {formatDate(selectedReport.createdAt)}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-background/30 p-6 space-y-6">
              {/* Alert Feedback */}
              {actionError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[13px] flex gap-2">
                  <ShieldAlert size={18} className="shrink-0" />
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-[13px] flex gap-2">
                  <Check size={18} className="shrink-0" />
                  {actionSuccess}
                </div>
              )}

              {/* Basic Report Info */}
              <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold block">ID Pelapor (Reporter)</span>
                  <span className="text-[13px] font-mono break-all text-text-primary">{selectedReport.reporterId}</span>
                </div>
                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold block">ID Terlapor (Reported User)</span>
                  <span className="text-[13px] font-mono break-all text-text-primary">{selectedReport.reportedId}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-black/5">
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Kategori Laporan</span>
                  <span className="text-[14px] font-semibold text-text-primary mt-0.5">{getTypeLabel(selectedReport.type)}</span>
                </div>
              </div>

              {/* Reported Item Info */}
              {selectedReport.itemId && selectedReport.itemId !== 'local_or_dummy_item' && (
                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Barang Yang Dilaporkan</h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[14px] font-semibold text-text-primary">{selectedReport.itemName}</p>
                      <p className="text-[12px] font-mono text-text-secondary mt-0.5">Item ID: {selectedReport.itemId}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Alasan Laporan</h3>
                <p className="text-[14px] text-text-primary leading-relaxed whitespace-pre-wrap">{selectedReport.reason}</p>
              </div>

              {/* Actions Box */}
              <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] space-y-4">
                <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider">Tindakan Admin</h3>
                
                {/* Status Update Buttons */}
                <div className="flex flex-wrap gap-2.5">
                  <span className="text-[13px] font-semibold text-text-secondary w-full">Ubah Status Laporan:</span>
                  <button
                    disabled={isSubmitting || selectedReport.status === 'investigating'}
                    onClick={() => handleUpdateStatus(selectedReport.id, 'investigating')}
                    className="px-4 py-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 text-[13px] font-medium rounded-full transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                    Investigasi
                  </button>
                  <button
                    disabled={isSubmitting || selectedReport.status === 'resolved'}
                    onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                    className="px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 text-[13px] font-medium rounded-full transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Selesaikan Laporan
                  </button>
                </div>

                {/* Moderation Actions */}
                <div className="flex flex-col gap-2.5 pt-3 border-t border-black/5">
                  <span className="text-[13px] font-semibold text-text-secondary">Tindakan Moderasi (Sekaligus Selesaikan Laporan):</span>
                  <div className="flex flex-wrap gap-3">
                    {selectedReport.itemId && selectedReport.itemId !== 'local_or_dummy_item' && (
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleBlockItem(selectedReport.itemId!, selectedReport.itemName!)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[13px] font-medium rounded-md transition-all flex items-center gap-1.5"
                      >
                        <PackageMinus size={15} /> Blokir Barang Ini
                      </button>
                    )}
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleSuspendUser(selectedReport.reportedId)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium rounded-md transition-all flex items-center gap-1.5"
                    >
                      <UserX size={15} /> Suspensi User Terlapor
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-6 py-2.5 rounded-full text-[14px] font-semibold bg-background border border-border-color text-text-primary hover:bg-black/5 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
