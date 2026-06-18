'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Eye, Loader2, X, ShieldAlert, 
  Check, RefreshCw, Calendar, AlertTriangle, Scale, CheckCircle2, Image as ImageIcon
} from 'lucide-react';
import Badge from '@/components/Badge';
import { fetchWithAuth } from '@/lib/api';

interface Dispute {
  id: string;
  transactionId: string;
  reportedBy: string;
  description: string;
  category: 'handover_rejection' | 'ongoing_damage' | 'checkout_damage' | string;
  evidenceUrl: string | null;
  evidenceUrls?: string[];
  status: 'open' | 'under_review' | 'resolved' | 'closed' | string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: any;
  resolvedAt: any | null;
  deadlineAt?: any;
  isOverdue?: boolean;

  // Respondent / Terlapor fields
  respondentId: string | null;
  respondentName: string | null;
  respondentDescription: string | null;
  respondentEvidenceUrls?: string[];
  respondentRespondedAt: any | null;

  reporterName: string;
  renterName: string;
  itemNames: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function DisputesManagement() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  
  // Transaction check-in/out evidence reference
  const [transactionEvidences, setTransactionEvidences] = useState<any[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);

  // Resolution form states
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (selectedDispute?.transactionId) {
      setLoadingEvidences(true);
      fetchWithAuth<ApiResponse<any>>(`/disputes/transaction/${selectedDispute.transactionId}`)
        .then(response => {
          if (response.success && response.data.transactionEvidences) {
            setTransactionEvidences(response.data.transactionEvidences);
          } else {
            setTransactionEvidences([]);
          }
        })
        .catch(err => {
          console.error('Error fetching dispute details:', err);
          setTransactionEvidences([]);
        })
        .finally(() => {
          setLoadingEvidences(false);
        });
    } else {
      setTransactionEvidences([]);
    }
  }, [selectedDispute?.transactionId]);

  const isDeadlinePassed = (dispute: Dispute) => {
    if (!dispute.deadlineAt) return false;
    const deadlineDate = new Date(
      typeof dispute.deadlineAt === 'object' && 'seconds' in dispute.deadlineAt
        ? dispute.deadlineAt.seconds * 1000
        : dispute.deadlineAt
    );
    return new Date() > deadlineDate;
  };


  const fetchDisputes = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetchWithAuth<ApiResponse<Dispute[]>>('/admin/disputes');
      if (response.success) {
        setDisputes(response.data);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDisputes(true);
  }, [fetchDisputes]);

  const handleSetUnderReview = async (disputeId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetchWithAuth<ApiResponse<Dispute>>(`/admin/disputes/${disputeId}/review`, {
        method: 'PATCH'
      });

      if (response.success) {
        setActionSuccess('Status sengketa berhasil diubah menjadi Under Review.');
        
        // Update local list
        setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: 'under_review' } : d));
        
        // Update modal state
        setSelectedDispute(prev => prev && prev.id === disputeId ? { ...prev, status: 'under_review' } : prev);
      }
    } catch (error: any) {
      console.error('Error setting dispute under review:', error);
      setActionError(error?.message || 'Gagal mengubah status sengketa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, decision: 'refund_to_renter' | 'release_to_owner') => {
    if (!resolutionNote.trim()) {
      setActionError('Catatan resolusi wajib diisi sebelum menyelesaikan sengketa.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetchWithAuth<ApiResponse<Dispute>>(`/admin/disputes/${disputeId}/resolve`, {
        method: 'PATCH',
        body: {
          resolutionNote: resolutionNote.trim(),
          decision
        }
      });

      if (response.success) {
        setActionSuccess(`Sengketa berhasil diselesaikan dengan keputusan: ${decision === 'refund_to_renter' ? 'Refund ke Penyewa' : 'Cairkan ke Pemilik'}`);
        setResolutionNote('');
        
        // Update local list
        setDisputes(prev => prev.map(d => d.id === disputeId ? { 
          ...d, 
          status: 'resolved', 
          resolutionNote: resolutionNote.trim(),
          resolvedAt: new Date().toISOString()
        } : d));

        // Update modal state
        setSelectedDispute(prev => prev && prev.id === disputeId ? { 
          ...prev, 
          status: 'resolved', 
          resolutionNote: resolutionNote.trim(),
          resolvedAt: new Date().toISOString()
        } : prev);
      }
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      setActionError(error?.message || 'Gagal menyelesaikan sengketa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeProps = (status: string): { status: 'active' | 'pending' | 'success' | 'error' | 'unverified'; label: string } => {
    switch (status) {
      case 'resolved': return { status: 'success', label: 'Resolved' };
      case 'under_review': return { status: 'pending', label: 'Under Review' };
      case 'open': return { status: 'error', label: 'Open' };
      case 'closed': return { status: 'unverified', label: 'Closed' };
      default: return { status: 'unverified', label: status || 'Unknown' };
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'handover_rejection': return 'Masalah Serah Terima Awal (COD)';
      case 'ongoing_damage': return 'Kerusakan Selama Masa Sewa';
      case 'checkout_damage': return 'Kerusakan/Kehilangan Pengembalian';
      default: return category;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    if (typeof timestamp === 'object') {
      if ('seconds' in timestamp && typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000).toLocaleString('id-ID');
      }
      if ('_seconds' in timestamp && typeof timestamp._seconds === 'number') {
        return new Date(timestamp._seconds * 1000).toLocaleString('id-ID');
      }
      if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString('id-ID');
      }
    }
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString('id-ID');
    return '-';
  };

  const processedDisputes = useMemo(() => {
    let result = [...disputes];

    // Filter by tab
    if (activeTab === 'active') {
      result = result.filter(d => d.status === 'open' || d.status === 'under_review');
    } else {
      result = result.filter(d => d.status === 'resolved' || d.status === 'closed');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.id.toLowerCase().includes(q) ||
        d.transactionId.toLowerCase().includes(q) ||
        (d.reporterName || '').toLowerCase().includes(q) ||
        (d.renterName || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.itemNames || []).some(name => name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [disputes, searchQuery, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Dispute Mediation</h1>
          <p className="text-[14px] text-text-secondary m-0">Menengahi dan menyelesaikan masalah transaksi atau klaim kerusakan antara pemilik dan penyewa.</p>
        </div>
        <button
          onClick={() => void fetchDisputes(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] font-medium text-text-primary hover:border-primary hover:text-primary transition-all shadow-[var(--shadow-soft)]"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Main Content Box */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col">
        {/* Tabs & Search */}
        <div className="px-6 pt-4 border-b border-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-6">
            <button
              onClick={() => {
                setActiveTab('active');
              }}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] ${
                activeTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Open Disputes
            </button>
            <button
              onClick={() => {
                setActiveTab('resolved');
              }}
              className={`pb-3 text-[14px] font-medium transition-all border-b-2 relative top-[1px] ${
                activeTab === 'resolved' ? 'border-primary text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Resolved
            </button>
          </div>

          <div className="relative mb-2 w-full md:w-[280px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Cari sengketa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : processedDisputes.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Scale size={48} className="text-border-color" />
              <p className="font-medium">Tidak ada sengketa ditemukan.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Dispute ID</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Transaksi</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Pelapor</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Barang</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kategori</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Tanggal</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {processedDisputes.map((dispute) => {
                  const badgeProps = getStatusBadgeProps(dispute.status);
                  return (
                    <tr key={dispute.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                      <td className="px-6 py-4 font-mono text-[13px] text-text-secondary">
                        {dispute.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px] text-primary font-medium">
                        {dispute.transactionId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-medium text-text-primary">{dispute.reporterName}</span>
                      </td>
                      <td className="px-6 py-4 max-w-[150px] truncate">
                        <span className="text-[13px] font-medium text-text-primary">
                          {dispute.itemNames && dispute.itemNames.length > 0 ? dispute.itemNames.join(', ') : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-text-secondary">{getCategoryLabel(dispute.category)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={badgeProps.status} label={badgeProps.label} />
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-tertiary">
                        {formatDate(dispute.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDispute(dispute);
                            setResolutionNote('');
                            setActionError(null);
                            setActionSuccess(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-full transition-all"
                        >
                          <Eye size={14} /> Review
                        </button>
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
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-surface w-full max-w-3xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary flex items-center gap-3">
                  Mediasi Sengketa
                  <Badge {...getStatusBadgeProps(selectedDispute.status)} />
                </h2>
                <p className="text-[13px] text-text-secondary mt-1 font-mono">
                  ID Sengketa: {selectedDispute.id}
                </p>
              </div>
              <button onClick={() => setSelectedDispute(null)} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
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
                  <CheckCircle2 size={18} className="shrink-0 text-status-success" />
                  {actionSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                {/* Section 1: Informasi Transaksi & Bukti Serah Terima Asli */}
                <div className="bg-surface p-5 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] space-y-4">
                  <h3 className="text-[14px] font-bold text-text-primary uppercase tracking-wider border-b pb-2 border-black/5 flex items-center gap-2">
                    <Scale size={16} className="text-primary" /> Informasi Mediasi & Bukti Transaksi
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">ID Transaksi</span>
                      <span className="text-[13px] font-mono break-all text-text-primary font-medium">{selectedDispute.transactionId}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Barang Sewa</span>
                      <span className="text-[13px] text-text-primary font-medium">{selectedDispute.itemNames?.join(', ') || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Kategori Masalah</span>
                      <span className="mt-0.5 block">
                        <Badge status="pending" label={getCategoryLabel(selectedDispute.category)} />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-black/5">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Penyewa (Renter)</span>
                      <span className="text-[13px] text-text-primary font-medium">{selectedDispute.renterName}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Tanggal Sengketa</span>
                      <span className="text-[13px] text-text-primary font-medium">{formatDate(selectedDispute.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Batas Waktu Sanggahan</span>
                      <span className="text-[13px] text-text-primary font-medium block">
                        {formatDate(selectedDispute.deadlineAt)}
                      </span>
                      {selectedDispute.status === 'open' && !selectedDispute.respondentId && (
                        isDeadlinePassed(selectedDispute) ? (
                          <span className="text-[11px] text-red-600 font-bold mt-0.5 block">🚨 Lewat Batas Waktu (Overdue)</span>
                        ) : (
                          <span className="text-[11px] text-yellow-600 font-bold mt-0.5 block">⏳ Sedang Berjalan (SLA 3 Hari)</span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Foto Serah Terima Check-in & Check-out dari transaksi asli */}
                  <div className="pt-4 border-t border-black/5 space-y-3">
                    <span className="text-[12px] font-bold text-text-secondary block">
                      Foto Kondisi Fisik Transaksi Asli (Check-in vs Check-out):
                    </span>
                    
                    {loadingEvidences ? (
                      <div className="flex items-center gap-2 py-4 justify-center text-text-tertiary text-[13px]">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        Memuat bukti transaksi...
                      </div>
                    ) : transactionEvidences.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {transactionEvidences.map((evidence) => (
                          <div key={evidence.id} className="relative border border-border-color rounded-lg overflow-hidden aspect-square bg-black/5 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={evidence.mediaUrl} 
                              alt="Transaction condition" 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge 
                                status={evidence.type === 'before' ? 'success' : 'pending'} 
                                label={evidence.type === 'before' ? 'Mulai Sewa (COD)' : 'Kembali'} 
                              />
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <a 
                                href={evidence.mediaUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="px-3 py-1 bg-white text-primary text-[11px] font-bold rounded-full shadow hover:scale-105 transition-all"
                              >
                                Buka Foto
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 border border-dashed border-border-color rounded-lg text-center text-text-tertiary text-[12px]">
                        Tidak ada foto bukti check-in/out yang diunggah di transaksi ini
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Kronologi & Bukti dari Pelapor vs Terlapor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pihak Pelapor */}
                  <div className="bg-surface p-5 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] flex flex-col space-y-4">
                    <div className="border-b pb-2.5 border-black/5">
                      <span className="text-[11px] text-red-600 font-bold uppercase block tracking-wider">Pihak Pelapor (Menggugat)</span>
                      <h4 className="text-[15px] font-bold text-text-primary mt-0.5">{selectedDispute.reporterName}</h4>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Kronologi Kejadian:</span>
                        <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap mt-1 bg-background/40 p-3 rounded-lg border border-black/5">
                          {selectedDispute.description || 'Tidak ada deskripsi tertulis.'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] text-text-tertiary uppercase font-semibold block mb-2">Foto Bukti Kerusakan:</span>
                        {(() => {
                          const photos = selectedDispute.evidenceUrls && selectedDispute.evidenceUrls.length > 0 
                            ? selectedDispute.evidenceUrls 
                            : (selectedDispute.evidenceUrl ? [selectedDispute.evidenceUrl] : []);
                          
                          if (photos.length === 0) {
                            return (
                              <div className="w-full h-[120px] flex flex-col items-center justify-center border border-dashed border-border-color rounded-lg text-text-tertiary text-[12px]">
                                <ImageIcon size={24} className="mb-1.5 opacity-45" />
                                Tidak ada foto bukti dilampirkan
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-3 gap-2">
                              {photos.map((url, i) => (
                                <div key={i} className="relative group border border-border-color rounded-lg overflow-hidden aspect-square bg-black/5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img 
                                    src={url} 
                                    alt={`Reporter Evidence ${i+1}`} 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="px-2.5 py-1 bg-white text-primary text-[10px] font-bold rounded-full shadow hover:scale-105 transition-all"
                                    >
                                      Buka
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Pihak Terlapor */}
                  <div className="bg-surface p-5 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] flex flex-col space-y-4">
                    <div className="border-b pb-2.5 border-black/5">
                      <span className="text-[11px] text-primary font-bold uppercase block tracking-wider">Pihak Terlapor (Tergugat)</span>
                      <h4 className="text-[15px] font-bold text-text-primary mt-0.5">
                        {selectedDispute.respondentName || (selectedDispute.reportedBy === selectedDispute.renterName ? 'Owner' : selectedDispute.renterName)}
                      </h4>
                    </div>

                    <div className="flex-1 space-y-3">
                      {selectedDispute.respondentId ? (
                        <>
                          <div>
                            <span className="text-[11px] text-text-tertiary uppercase font-semibold block">Sanggahan / Kronologi Pembanding:</span>
                            <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap mt-1 bg-background/40 p-3 rounded-lg border border-black/5">
                              {selectedDispute.respondentDescription}
                            </p>
                          </div>

                          <div>
                            <span className="text-[11px] text-text-tertiary uppercase font-semibold block mb-2">Foto Bukti Sanggahan:</span>
                            {(() => {
                              const photos = selectedDispute.respondentEvidenceUrls || [];
                              if (photos.length === 0) {
                                return (
                                  <div className="w-full h-[120px] flex flex-col items-center justify-center border border-dashed border-border-color rounded-lg text-text-tertiary text-[12px]">
                                    <ImageIcon size={24} className="mb-1.5 opacity-45" />
                                    Tidak ada foto bukti sanggahan dilampirkan
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-3 gap-2">
                                  {photos.map((url, i) => (
                                    <div key={i} className="relative group border border-border-color rounded-lg overflow-hidden aspect-square bg-black/5">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img 
                                        src={url} 
                                        alt={`Respondent Evidence ${i+1}`} 
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <a 
                                          href={url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="px-2.5 py-1 bg-white text-primary text-[10px] font-bold rounded-full shadow hover:scale-105 transition-all"
                                        >
                                          Buka
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center rounded-lg border border-dashed border-border-color bg-background/20 h-full">
                          {isDeadlinePassed(selectedDispute) ? (
                            <div className="space-y-2 text-red-600">
                              <AlertTriangle size={32} className="mx-auto text-red-500 animate-bounce" />
                              <h5 className="font-bold text-[14px]">Batas Waktu Sanggahan Habis</h5>
                              <p className="text-[12px] text-text-secondary leading-relaxed">
                                Terlapor tidak memberikan sanggahan dalam batas waktu 3x24 jam sejak sengketa diajukan. Admin berhak mengambil keputusan secara sepihak.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 text-yellow-600">
                              <Loader2 size={32} className="mx-auto text-yellow-500 animate-spin" />
                              <h5 className="font-bold text-[14px]">Menunggu Sanggahan Terlapor</h5>
                              <p className="text-[12px] text-text-secondary leading-relaxed">
                                Terlapor memiliki waktu hingga <strong>{formatDate(selectedDispute.deadlineAt)}</strong> untuk memberikan argumen pembanding dan foto bukti kondisi barang.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Note log if resolved */}
                {selectedDispute.status === 'resolved' && (
                  <div className="bg-green-50/50 p-4 rounded-[var(--radius-md)] border border-green-200 shadow-[var(--shadow-soft)] space-y-2">
                    <h3 className="text-[12px] font-bold text-green-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Check size={14} /> Catatan Mediasi
                    </h3>
                    <div>
                      <span className="text-[11px] text-green-700 block">Selesai pada: {formatDate(selectedDispute.resolvedAt)}</span>
                    </div>
                    <p className="text-[13px] text-green-900 leading-relaxed whitespace-pre-wrap pt-1.5 border-t border-green-200/50">
                      {selectedDispute.resolutionNote || 'Sengketa ditutup tanpa catatan.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Controls for open / under_review */}
              {(selectedDispute.status === 'open' || selectedDispute.status === 'under_review') && (
                <div className="bg-surface p-5 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] space-y-4">
                  <h3 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Scale size={16} className="text-primary" /> Keputusan & Resolusi Mediasi
                  </h3>

                  {selectedDispute.status === 'open' && (
                    <div className="flex items-center justify-between p-3.5 bg-yellow-50/50 border border-yellow-100 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800 text-[13px]">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>Sengketa baru diajukan. Ubah status menjadi <strong>Under Review</strong> terlebih dahulu untuk meninjau secara resmi.</span>
                      </div>
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleSetUnderReview(selectedDispute.id)}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-[12px] font-bold rounded-full transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                        Tinjau Sengketa
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <label className="text-[13px] font-semibold text-text-secondary block">Catatan Mediasi / Resolusi (Wajib):</label>
                    <textarea
                      placeholder="Jelaskan alasan dan kesimpulan dari keputusan mediasi ini secara detail (misal: Renter mengembalikan unit dengan lecet berat, sehingga deposit dipotong)..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full min-h-[80px] p-3 border border-border-color rounded-lg text-[13.5px] bg-background text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row justify-end gap-3 pt-2">
                    <button
                      disabled={isSubmitting || !resolutionNote.trim()}
                      onClick={() => handleResolveDispute(selectedDispute.id, 'refund_to_renter')}
                      className="px-5 py-2.5 rounded-full text-[13px] font-bold border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50 transition-all disabled:opacity-40 flex items-center gap-1.5 justify-center"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Refund ke Penyewa (Renter)
                    </button>
                    <button
                      disabled={isSubmitting || !resolutionNote.trim()}
                      onClick={() => handleResolveDispute(selectedDispute.id, 'release_to_owner')}
                      className="px-6 py-2.5 rounded-full text-[13px] font-bold bg-primary text-white hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center gap-1.5 justify-center"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Cairkan Dana ke Pemilik (Owner)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-between items-center">
              <span className="text-[12px] text-text-tertiary">
                Tanggal Dibuat: {formatDate(selectedDispute.createdAt)}
              </span>
              <button
                onClick={() => setSelectedDispute(null)}
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
