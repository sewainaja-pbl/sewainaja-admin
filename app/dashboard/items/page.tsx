'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Eye, Download, Loader2, X, Package,
  ChevronLeft, ChevronRight, AlertCircle, Star, Image as ImageIcon
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { useAuth } from '@/components/AuthProvider';
import Badge from '@/components/Badge';

type FirestoreTimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

interface ItemDoc {
  id: string;
  ownerId: string;
  categoryId: string;
  name: string;
  description: string;
  pricePerHour: number;
  estimatedValue: number;
  status: string;
  blockedReason?: string;
  blockedBy?: string;
  blockedAt?: Timestamp | FirestoreTimestampLike | string;
  condition: string;
  photos: string[];
  qrCodeToken: string;
  createdAt: Timestamp | FirestoreTimestampLike | string;
  updatedAt: Timestamp | FirestoreTimestampLike | string;
  ownerName?: string;
  ownerRating?: number;
  categoryName?: string;
  categoryPhotoUrl?: string;
  address?: {
    addressId: string;
    label: string;
    fullAddress: string;
    coordinat?: object;
    geohash?: string;
  };
}

export default function ItemsManagement() {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [sortOption, setSortOption] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedItem, setSelectedItem] = useState<ItemDoc | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();

  const handleBlockItem = async () => {
    if (!selectedItem || !user || !blockReason.trim()) return;
    
    setIsSubmitting(true);
    try {
      const itemRef = doc(db, 'items', selectedItem.id);
      await updateDoc(itemRef, {
        status: 'blocked',
        blockedReason: blockReason.trim(),
        blockedBy: user.uid,
        blockedAt: serverTimestamp()
      });
      
      const updatedItem = {
        ...selectedItem,
        status: 'blocked',
        blockedReason: blockReason.trim(),
        blockedBy: user.uid,
        blockedAt: new Date().toISOString()
      };

      setItems(prev => prev.map(item => item.id === selectedItem.id ? updatedItem : item));
      setSelectedItem(updatedItem);
      
      setIsBlockModalOpen(false);
      setBlockReason('');
    } catch (error) {
      console.error('Error blocking item:', error);
      alert('Gagal memblokir barang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ItemDoc[];
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const getStatusBadgeProps = (status: string): { status: 'active' | 'pending' | 'success' | 'error' | 'unverified'; label: string } => {
    switch (status) {
      case 'available': return { status: 'success', label: 'Available' };
      case 'inactive': return { status: 'pending', label: 'Inactive' };
      case 'archived': return { status: 'error', label: 'Archived' };
      case 'blocked': return { status: 'error', label: 'Blocked' };
      default: return { status: 'unverified', label: status || 'Unknown' };
    }
  };

  const getConditionLabel = (condition: string): string => {
    switch (condition) {
      case 'new': return 'Baru';
      case 'like-new': return 'Seperti Baru';
      case 'fair': return 'Cukup Baik';
      case 'poor': return 'Kurang Baik';
      default: return condition;
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const processedItems = useMemo(() => {
    let result = [...items];

    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (conditionFilter !== 'all') {
      result = result.filter(item => item.condition === conditionFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.id.toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.ownerName || '').toLowerCase().includes(q) ||
        (item.categoryName || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortOption === 'price_desc') return b.pricePerHour - a.pricePerHour;
      if (sortOption === 'price_asc') return a.pricePerHour - b.pricePerHour;
      if (sortOption === 'rating_desc') return (b.ownerRating || 0) - (a.ownerRating || 0);
      if (sortOption === 'name_asc') return (a.name || '').localeCompare(b.name || '');

      const getMs = (ts: any) => {
        if (!ts) return 0;
        if (ts instanceof Timestamp) return ts.toMillis();
        if (ts.seconds) return ts.seconds * 1000;
        if (typeof ts === 'string') return new Date(ts).getTime();
        return 0;
      };

      const timeA = getMs(a.createdAt);
      const timeB = getMs(b.createdAt);

      if (sortOption === 'date_asc') return timeA - timeB;
      return timeB - timeA;
    });

    return result;
  }, [items, searchQuery, statusFilter, conditionFilter, sortOption]);

  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const currentItems = processedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, conditionFilter, sortOption]);

  const handleExportCSV = () => {
    if (processedItems.length === 0) return;

    const headers = ['Item ID', 'Nama Barang', 'Pemilik', 'Kategori', 'Harga/Jam', 'Status', 'Kondisi', 'Rating', 'Lokasi', 'Tanggal'];
    const rows = processedItems.map(item => [
      item.id,
      item.name || '-',
      item.ownerName || '-',
      item.categoryName || '-',
      item.pricePerHour.toString(),
      item.status,
      getConditionLabel(item.condition),
      (item.ownerRating || 0).toString(),
      item.address?.label || '-',
      formatDate(item.createdAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `items_export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Items</h1>
          <p className="text-[14px] text-text-secondary m-0">Pantau dan kelola seluruh barang yang telah ditambahkan.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={processedItems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] font-medium text-text-primary hover:border-primary hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-soft)]"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters & Search Box */}
      <div className="bg-surface rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-soft)] border border-border-color flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-auto flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Cari nama barang, pemilik, kategori..."
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
            <option value="available">Available</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">Semua Kondisi</option>
            <option value="new">Baru</option>
            <option value="like-new">Seperti Baru</option>
            <option value="fair">Cukup Baik</option>
            <option value="poor">Kurang Baik</option>
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="date_desc">Terbaru</option>
            <option value="date_asc">Terlama</option>
            <option value="price_desc">Harga Tertinggi</option>
            <option value="price_asc">Harga Terendah</option>
            <option value="rating_desc">Rating Tertinggi</option>
            <option value="name_asc">Nama A-Z</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border-color flex items-center justify-between bg-black/5">
          <span className="text-[13px] font-medium text-text-secondary">
            Menampilkan {currentItems.length} dari {processedItems.length} barang
          </span>
          <button onClick={() => void fetchItems()} className="text-text-tertiary hover:text-primary transition-colors">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : currentItems.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Package size={48} className="text-border-color" />
              <p className="font-medium">Tidak ada barang ditemukan.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Foto</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Nama Barang</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Pemilik</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kategori</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Harga/Jam</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kondisi</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Rating</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Tanggal</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {currentItems.map((item) => {
                  const badgeProps = getStatusBadgeProps(item.status);
                  const primaryPhoto = item.photos?.[0];
                  return (
                    <tr key={item.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded-lg bg-background border border-border-color overflow-hidden shrink-0">
                          {primaryPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={primaryPhoto} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black/5">
                              <ImageIcon className="text-text-tertiary opacity-50" size={20} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-text-primary">{item.name || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-text-primary">{item.ownerName || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] text-text-secondary">{item.categoryName || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-semibold text-primary">{formatCurrency(item.pricePerHour)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={badgeProps.status} label={badgeProps.label} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-text-tertiary">{getConditionLabel(item.condition)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star size={14} className="text-accent-gold fill-accent-gold" />
                          <span className="text-[13px] font-semibold text-text-primary">{(item.ownerRating || 0).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-tertiary">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-full transition-all opacity-0 group-hover:opacity-100 focus-within:opacity-100"
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
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary flex items-center gap-3">
                  Detail Barang
                  <Badge {...getStatusBadgeProps(selectedItem.status)} />
                </h2>
                <p className="text-[13px] text-text-secondary mt-1">
                  ID: <span className="font-mono">{selectedItem.id}</span> • {formatDate(selectedItem.createdAt)}
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-background/30 p-6 space-y-6">

              {/* Owner Info */}
              <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Informasi Pemilik</h3>
                <div className="flex flex-col gap-2">
                  <span className="text-[15px] font-semibold text-text-primary">{selectedItem.ownerName || 'Unknown Owner'}</span>
                  <span className="text-[12px] font-mono text-text-tertiary break-all">ID: {selectedItem.ownerId}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={14} className="text-accent-gold fill-accent-gold" />
                    <span className="text-[14px] font-semibold text-text-primary">{(selectedItem.ownerRating || 0).toFixed(1)}</span>
                    <span className="text-[12px] text-text-secondary">({selectedItem.ownerRating ? 'Verified' : 'No Rating'})</span>
                  </div>
                </div>
              </div>

              {/* Item Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Informasi Dasar</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Nama</span>
                      <p className="text-[14px] font-medium text-text-primary mt-0.5">{selectedItem.name}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Kategori</span>
                      <p className="text-[14px] font-medium text-text-primary mt-0.5">{selectedItem.categoryName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Kondisi</span>
                      <p className="text-[14px] font-medium text-text-primary mt-0.5">{getConditionLabel(selectedItem.condition)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Harga & Nilai</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Harga Sewa/Jam</span>
                      <p className="text-[16px] font-bold text-primary mt-0.5">{formatCurrency(selectedItem.pricePerHour)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Nilai Estimasi</span>
                      <p className="text-[14px] font-medium text-text-primary mt-0.5">{formatCurrency(selectedItem.estimatedValue)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Deskripsi</h3>
                <p className="text-[14px] text-text-primary leading-relaxed">{selectedItem.description || '-'}</p>
              </div>

              {/* Photo Gallery */}
              <div className="bg-surface rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] overflow-hidden">
                <div className="px-4 py-3 border-b border-border-color bg-black/5">
                  <h3 className="text-[14px] font-bold text-text-primary">Foto Barang ({selectedItem.photos?.length || 0})</h3>
                </div>
                <div className="p-4">
                  {!selectedItem.photos || selectedItem.photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
                      <ImageIcon size={32} className="mb-2 opacity-50" />
                      <p className="text-[13px] font-medium">Tidak ada foto</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {selectedItem.photos.map((photoUrl, idx) => (
                        <div key={idx} className="aspect-square rounded-lg bg-background border border-border-color overflow-hidden group cursor-pointer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoUrl}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {idx === 0 && (
                            <div className="absolute top-2 left-2 bg-primary/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                              Utama
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Address Info */}
              {selectedItem.address && (
                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Lokasi Barang</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Label Lokasi</span>
                      <p className="text-[14px] font-medium text-text-primary mt-0.5">{selectedItem.address.label || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-tertiary uppercase font-semibold">Alamat Lengkap</span>
                      <p className="text-[14px] text-text-primary mt-0.5 break-words">{selectedItem.address.fullAddress || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Footer */}
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-[var(--radius-md)] border border-primary/20">
                <div>
                  <span className="text-[13px] text-text-secondary font-medium uppercase tracking-wide">Status</span>
                  <p className="text-[14px] font-semibold text-text-primary mt-1">{getStatusBadgeProps(selectedItem.status).label}</p>
                </div>
                <div className="text-right">
                  <span className="text-[13px] text-text-secondary font-medium uppercase tracking-wide">Harga/Jam</span>
                  <p className="text-[18px] font-bold text-primary mt-1">{formatCurrency(selectedItem.pricePerHour)}</p>
                </div>
              </div>

              {/* Blocked Information */}
              {selectedItem.status === 'blocked' && (
                <div className="bg-red-50 p-4 rounded-[var(--radius-md)] border border-red-200 shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-red-800 uppercase tracking-wider mb-2">Informasi Pemblokiran</h3>
                  <div className="space-y-1">
                    <p className="text-[14px] text-red-700"><span className="font-semibold">Alasan:</span> {selectedItem.blockedReason || '-'}</p>
                    <p className="text-[13px] text-red-600">Oleh Admin ID: <span className="font-mono">{selectedItem.blockedBy || '-'}</span> pada {formatDate(selectedItem.blockedAt)}</p>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-end gap-3">
              {selectedItem.status !== 'blocked' && (
                <button
                  onClick={() => setIsBlockModalOpen(true)}
                  className="px-6 py-2.5 rounded-full text-[14px] font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all"
                >
                  Blokir Barang
                </button>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="px-6 py-2.5 rounded-full text-[14px] font-semibold bg-background border border-border-color text-text-primary hover:bg-black/5 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal Prompt */}
      {isBlockModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-[var(--radius-lg)] shadow-2xl overflow-hidden p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-text-primary mb-2">Blokir Barang</h2>
            <p className="text-[14px] text-text-secondary mb-4">
              Anda yakin ingin memblokir <strong>{selectedItem.name}</strong>? Barang ini tidak akan bisa disewa lagi.
            </p>
            
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-text-tertiary mb-1.5">Alasan Pemblokiran <span className="text-red-500">*</span></label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Masukkan alasan yang jelas..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border-color rounded-[var(--radius-md)] text-[14px] text-text-primary focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsBlockModalOpen(false);
                  setBlockReason('');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-[14px] font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleBlockItem}
                disabled={isSubmitting || !blockReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-[14px] font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                Blokir Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
