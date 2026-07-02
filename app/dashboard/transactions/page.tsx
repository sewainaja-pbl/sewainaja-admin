'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Eye, Download, Loader2, X, Receipt, 
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { db } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, Timestamp, where, getDoc, doc } from 'firebase/firestore';
import Badge from '@/components/Badge';

type FirestoreTimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

interface TransactionDoc {
  id: string;
  renterId: string;
  ownerId: string;
  totalPrice: number;
  totalItems: number;
  status: string;
  isOverdue: boolean;
  createdAt: Timestamp | FirestoreTimestampLike | string;
  updatedAt: Timestamp | FirestoreTimestampLike | string;
  renterName?: string;
  ownerName?: string;
}

interface TransactionDetailDoc {
  id: string;
  itemId: string;
  startDate: Timestamp | FirestoreTimestampLike | string;
  endDate: Timestamp | FirestoreTimestampLike | string;
  priceAtBooking: number;
  itemNameSnapshot: string;
  itemPhotoUrlSnapshot: string;
  subtotal: number;
}

interface PaymentDoc {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  midtransOrderId: string | null;
  midtransPaymentType: string | null;
  paymentProofUrl: string | null;
  paidAt: Timestamp | FirestoreTimestampLike | string | null;
  createdAt: Timestamp | FirestoreTimestampLike | string;
}

export default function TransactionsManagement() {
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOption, setSortOption] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal states
  const [selectedTx, setSelectedTx] = useState<TransactionDoc | null>(null);
  const [txDetails, setTxDetails] = useState<TransactionDetailDoc[]>([]);
  const [txPayments, setTxPayments] = useState<PaymentDoc[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all transactions to allow client-side filtering, searching, and pagination.
      // This is efficient enough for thousands of records without Elasticsearch.
      const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TransactionDoc[];
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const getStatusBadgeProps = (status: string): { status: 'active' | 'pending' | 'success' | 'error' | 'unverified'; label: string } => {
    switch (status) {
      case 'completed': return { status: 'success', label: 'Completed' };
      case 'ongoing': return { status: 'active', label: 'Ongoing' };
      case 'approved': return { status: 'active', label: 'Approved' };
      case 'pending': return { status: 'pending', label: 'Pending' };
      case 'cancelled': return { status: 'error', label: 'Cancelled' };
      case 'disputed': return { status: 'error', label: 'Disputed' };
      default: return { status: 'unverified', label: status || 'Unknown' };
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

  // Filter, Search, and Sort
  const processedTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(tx => tx.status === statusFilter);
    }

    // Search by ID or names
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tx => 
        tx.id.toLowerCase().includes(q) ||
        (tx.renterName || '').toLowerCase().includes(q) ||
        (tx.ownerName || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'price_desc') return b.totalPrice - a.totalPrice;
      if (sortOption === 'price_asc') return a.totalPrice - b.totalPrice;
      
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
      return timeB - timeA; // date_desc is default
    });

    return result;
  }, [transactions, searchQuery, statusFilter, sortOption]);

  // Pagination
  const totalPages = Math.ceil(processedTransactions.length / itemsPerPage);
  const currentTransactions = processedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOption]);

  // View Details Handler
  const handleViewDetails = async (tx: TransactionDoc) => {
    setSelectedTx(tx);
    setDetailsLoading(true);
    try {
      // 1. Fetch Transaction Details (subcollection)
      const detailsQuery = query(collection(db, 'transactions', tx.id, 'transaction_details'));
      const detailsSnap = await getDocs(detailsQuery);
      setTxDetails(detailsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as TransactionDetailDoc));

      // 2. Fetch Payments
      const paymentsQuery = query(collection(db, 'payments'), where('transactionId', '==', tx.id));
      const paymentsSnap = await getDocs(paymentsQuery);
      setTxPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentDoc));
      
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (processedTransactions.length === 0) return;

    const headers = ['Transaction ID', 'Renter', 'Owner', 'Total Price', 'Total Items', 'Status', 'Date'];
    const rows = processedTransactions.map(tx => [
      tx.id,
      tx.renterName || '-',
      tx.ownerName || '-',
      tx.totalPrice.toString(),
      tx.totalItems.toString(),
      tx.status,
      formatDate(tx.createdAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().getTime()}.csv`);
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
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Transactions</h1>
          <p className="text-[14px] text-text-secondary m-0">Pantau dan kelola seluruh transaksi penyewaan barang.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={processedTransactions.length === 0}
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
            placeholder="Cari ID transaksi, nama penyewa, pemilik..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" 
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="disputed">Disputed</option>
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
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border-color flex items-center justify-between bg-black/5">
          <span className="text-[13px] font-medium text-text-secondary">
            Menampilkan {currentTransactions.length} dari {processedTransactions.length} transaksi
          </span>
          <button onClick={() => void fetchTransactions()} className="text-text-tertiary hover:text-primary transition-colors">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : currentTransactions.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Receipt size={48} className="text-border-color" />
              <p className="font-medium">Tidak ada transaksi ditemukan.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">ID Transaksi</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Penyewa</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Pemilik</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Total Harga</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Tanggal</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {currentTransactions.map((tx) => {
                  const badgeProps = getStatusBadgeProps(tx.status);
                  return (
                    <tr key={tx.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] font-semibold text-text-tertiary bg-background border border-border-color rounded px-2 py-0.5">{tx.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-text-primary">{tx.renterName || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-text-primary">{tx.ownerName || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-semibold text-primary">{formatCurrency(tx.totalPrice)}</span>
                        <div className="text-[11px] text-text-tertiary">{tx.totalItems} barang</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={badgeProps.status} label={badgeProps.label} />
                        {tx.isOverdue && (
                          <span className="ml-2 inline-flex text-[10px] bg-status-error/10 text-status-error px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Overdue</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-tertiary">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleViewDetails(tx)}
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

        {/* Pagination Controls */}
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
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary flex items-center gap-3">
                  Detail Transaksi
                  <Badge {...getStatusBadgeProps(selectedTx.status)} />
                </h2>
                <p className="text-[13px] text-text-secondary mt-1">
                  ID: <span className="font-mono">{selectedTx.id}</span> • {formatDate(selectedTx.createdAt)}
                </p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-background/30 p-6 space-y-6">
              
              {/* Users Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Penyewa (Renter)</h3>
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-semibold text-text-primary">{selectedTx.renterName || 'Unknown User'}</span>
                    <span className="text-[12px] font-mono text-text-tertiary break-all">ID: {selectedTx.renterId}</span>
                  </div>
                </div>
                <div className="bg-surface p-4 rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)]">
                  <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Pemilik (Owner)</h3>
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-semibold text-text-primary">{selectedTx.ownerName || 'Unknown User'}</span>
                    <span className="text-[12px] font-mono text-text-tertiary break-all">ID: {selectedTx.ownerId}</span>
                  </div>
                </div>
              </div>

              {/* Transaction Details (Items) */}
              <div className="bg-surface rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] overflow-hidden">
                <div className="px-4 py-3 border-b border-border-color bg-black/5">
                  <h3 className="text-[14px] font-bold text-text-primary">Daftar Barang ({selectedTx.totalItems})</h3>
                </div>
                <div className="p-4">
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
                  ) : txDetails.length === 0 ? (
                    <p className="text-[13px] text-text-tertiary text-center py-4">Detail barang tidak ditemukan.</p>
                  ) : (
                    <div className="space-y-4">
                      {txDetails.map((detail) => (
                        <div key={detail.id} className="flex gap-4 p-3 border border-border-color rounded-lg bg-background">
                          <div className="w-16 h-16 rounded-md bg-surface border border-border-color overflow-hidden shrink-0">
                            {detail.itemPhotoUrlSnapshot ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={detail.itemPhotoUrlSnapshot} alt={detail.itemNameSnapshot} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-black/5"><Receipt className="text-text-tertiary opacity-50" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[14px] font-semibold text-text-primary truncate">{detail.itemNameSnapshot}</h4>
                            <div className="text-[12px] text-text-secondary mt-1 flex flex-wrap gap-x-4 gap-y-1">
                              <span>Harga sewa: {formatCurrency(detail.priceAtBooking)}</span>
                              <span>Periode: {formatDate(detail.startDate)} - {formatDate(detail.endDate)}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-text-tertiary uppercase font-semibold mb-0.5">Subtotal</div>
                            <div className="text-[14px] font-bold text-primary">{formatCurrency(detail.subtotal)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-surface rounded-[var(--radius-md)] border border-border-color shadow-[var(--shadow-soft)] overflow-hidden">
                <div className="px-4 py-3 border-b border-border-color bg-black/5">
                  <h3 className="text-[14px] font-bold text-text-primary">Data Pembayaran</h3>
                </div>
                <div className="p-4">
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>
                  ) : txPayments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
                      <AlertCircle size={32} className="mb-2 opacity-50" />
                      <p className="text-[13px] font-medium">Belum ada data pembayaran</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {txPayments.map((payment) => (
                        <div key={payment.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-background border border-border-color rounded-lg gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[15px] font-bold text-text-primary">{formatCurrency(payment.amount)}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                payment.status === 'paid' ? 'bg-status-success/10 text-status-success' :
                                payment.status === 'pending' ? 'bg-status-pending/10 text-status-pending' :
                                payment.status === 'failed' ? 'bg-status-error/10 text-status-error' :
                                'bg-black/5 text-text-secondary'
                              }`}>
                                {payment.status}
                              </span>
                            </div>
                            <div className="text-[12px] text-text-secondary flex flex-col gap-0.5">
                              <span>Metode: <span className="font-semibold uppercase">{payment.paymentMethod}</span> {payment.midtransPaymentType ? `(${payment.midtransPaymentType})` : ''}</span>
                              {payment.midtransOrderId && <span>Order ID: <span className="font-mono">{payment.midtransOrderId}</span></span>}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1 text-right text-[12px] text-text-secondary">
                            <span className="flex items-center justify-end gap-1"><Clock size={12} /> Dibuat: {formatDate(payment.createdAt)}</span>
                            {payment.paidAt && <span className="flex items-center justify-end gap-1 text-status-success"><CheckCircle2 size={12} /> Dibayar: {formatDate(payment.paidAt)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Footer */}
              <div className="flex items-center justify-end p-4 bg-primary/5 rounded-[var(--radius-md)] border border-primary/20">
                <div className="text-right">
                  <span className="text-[13px] text-text-secondary font-medium uppercase tracking-wide mr-4">Total Transaksi</span>
                  <span className="text-[24px] font-bold text-primary">{formatCurrency(selectedTx.totalPrice)}</span>
                </div>
              </div>

            </div>
            
            {/* Modal Actions */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-end">
              <button 
                onClick={() => setSelectedTx(null)}
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
