'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tags, Search, Plus, Pencil, Trash2, Loader2, X, Check, ImagePlus, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface ItemCategoryDoc {
  id: string;
  category: string;
  code: string;
  photoUrl: string;
  subcategories: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: { message?: string };
}

const EMPTY_FORM = { category: '', code: '', photoUrl: '', subcategories: [] as string[] };

export default function CategoriesManagement() {
  const [categories, setCategories] = useState<ItemCategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItemCategoryDoc | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newSubcategory, setNewSubcategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth<ApiResponse<ItemCategoryDoc[]>>('/categories');
      if (res.success) setCategories(res.data);
    } catch (e) {
      console.error('Error fetching categories:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCategories(); }, [fetchCategories]);

  const openAddModal = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setPreviewUrl(null);
    setUploadFile(null);
    setUploadProgress(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (cat: ItemCategoryDoc) => {
    setEditingCategory(cat);
    setForm({ category: cat.category, code: cat.code, photoUrl: cat.photoUrl, subcategories: [...cat.subcategories] });
    setPreviewUrl(cat.photoUrl);
    setUploadFile(null);
    setUploadProgress(null);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingCategory(null);
    setPreviewUrl(null);
    setUploadFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImageToStorage = async (file: File, categoryId: string): Promise<string> => {
    const storageRef = ref(storage, `category_icons/${categoryId}_${Date.now()}_${file.name}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on(
        'state_changed',
        (snapshot) => {
          setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        },
      );
    });
  };

  const addSubcategory = () => {
    const trimmed = newSubcategory.trim();
    if (!trimmed || form.subcategories.includes(trimmed)) return;
    setForm((prev) => ({ ...prev, subcategories: [...prev.subcategories, trimmed] }));
    setNewSubcategory('');
  };

  const removeSubcategory = (idx: number) => {
    setForm((prev) => ({ ...prev, subcategories: prev.subcategories.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.category.trim()) return setFormError('Nama kategori tidak boleh kosong.');
    if (!form.code.trim()) return setFormError('Kode kategori tidak boleh kosong.');
    if (!editingCategory && !uploadFile && !form.photoUrl) return setFormError('Foto kategori wajib diunggah.');

    setSaving(true);
    try {
      let finalPhotoUrl = form.photoUrl;

      if (uploadFile) {
        // For new categories, use a temp placeholder ID; server returns real ID
        const tempId = editingCategory ? editingCategory.id : `temp_${Date.now()}`;
        finalPhotoUrl = await uploadImageToStorage(uploadFile, tempId);
        setUploadProgress(null);
      }

      if (editingCategory) {
        const res = await fetchWithAuth<ApiResponse<ItemCategoryDoc>>(`/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: { category: form.category.trim(), code: form.code.trim(), photoUrl: finalPhotoUrl, subcategories: form.subcategories },
        });
        if (res.success) {
          setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? res.data : c)));
          closeModal();
        }
      } else {
        const res = await fetchWithAuth<ApiResponse<ItemCategoryDoc>>('/categories', {
          method: 'POST',
          body: { category: form.category.trim(), code: form.code.trim(), photoUrl: finalPhotoUrl, subcategories: form.subcategories },
        });
        if (res.success) {
          setCategories((prev) => [...prev, res.data].sort((a, b) => a.id.localeCompare(b.id)));
          closeModal();
        }
      }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Terjadi kesalahan, coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: ItemCategoryDoc) => {
    if (!confirm(`Hapus kategori "${cat.category}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingId(cat.id);
    try {
      await fetchWithAuth(`/categories/${cat.id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = categories.filter(
    (c) =>
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Edit Categories</h1>
          <p className="text-[14px] text-text-secondary m-0">Kelola kategori dan subkategori barang yang tersedia di platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Cari kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-surface border border-border-color rounded-full text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full md:w-[260px] shadow-[var(--shadow-soft)]"
            />
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-[14px] font-semibold rounded-full shadow-[0_4px_12px_rgba(1,45,29,0.25)] hover:brightness-110 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Plus size={18} />
            Tambah Kategori
          </button>
        </div>
      </div>

      {/* Grid / Table */}
      <div className="bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] border border-border-color overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <p className="text-[13px] text-text-secondary font-medium">
            {loading ? 'Memuat...' : `${filtered.length} kategori ditemukan`}
          </p>
          <button onClick={() => void fetchCategories()} className="p-2 text-text-tertiary hover:text-primary transition-colors" title="Refresh">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Tags size={18} />}
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="w-full h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="text-primary animate-spin" />
                <span className="text-[14px] font-medium text-text-secondary">Memuat kategori...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Tags size={48} className="text-border-color" />
              <p className="font-medium">Belum ada kategori.</p>
              {searchQuery && <p className="text-[12px]">Coba kata kunci lain.</p>}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background/50 text-left">
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">ID</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Foto</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kategori</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Kode</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase">Subkategori</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-text-secondary tracking-wider uppercase text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map((cat) => (
                  <tr key={cat.id} className="hover:bg-accent-green-pale/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-[13px] font-semibold text-text-tertiary bg-background border border-border-color rounded px-2 py-0.5">{cat.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-background border border-border-color shadow-[var(--shadow-soft)] flex items-center justify-center">
                        {cat.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.photoUrl} alt={cat.category} className="w-full h-full object-cover" />
                        ) : (
                          <Tags size={20} className="text-text-tertiary" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[14px] font-semibold text-text-primary">{cat.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-mono text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">{cat.code}</span>
                    </td>
                    <td className="px-6 py-4 max-w-[280px]">
                      <div className="flex flex-wrap gap-1.5">
                        {cat.subcategories.length === 0 ? (
                          <span className="text-[12px] text-text-tertiary italic">-</span>
                        ) : (
                          cat.subcategories.map((sub) => (
                            <span key={sub} className="text-[11px] bg-background border border-border-color rounded-full px-2.5 py-0.5 text-text-secondary font-medium">{sub}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-full transition-all"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          disabled={deletingId === cat.id}
                          onClick={() => void handleDelete(cat)}
                          className="p-1.5 text-status-error bg-status-error/10 hover:bg-status-error hover:text-white rounded-full transition-all disabled:opacity-50"
                          title="Hapus"
                        >
                          {deletingId === cat.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-surface w-full max-w-2xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 flex justify-between items-center">
              <div>
                <h2 className="text-[20px] font-bold text-text-primary">
                  {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                </h2>
                {editingCategory && (
                  <p className="text-[13px] text-text-tertiary mt-0.5">ID: <span className="font-mono">{editingCategory.id}</span></p>
                )}
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-black/5 text-text-tertiary transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-background/30 space-y-5">

              {/* Photo Upload */}
              <div>
                <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide block mb-2">Foto / Ikon Kategori</label>
                <div className="flex items-start gap-4">
                  <div
                    className="w-24 h-24 rounded-2xl border-2 border-dashed border-border-color bg-surface flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden shrink-0 relative group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ImagePlus size={20} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-text-tertiary p-2 text-center">
                        <ImagePlus size={22} />
                        <span className="text-[10px]">Unggah foto</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-4 rounded-xl border border-border-color bg-surface text-[13px] text-text-secondary hover:border-primary hover:text-primary transition-all text-left"
                    >
                      {uploadFile ? uploadFile.name : 'Pilih file gambar...'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {uploadProgress !== null && (
                      <div className="w-full bg-border-color rounded-full h-1.5 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    <p className="text-[11px] text-text-tertiary">JPG, PNG, atau WebP. Maks 2MB. Rasio 1:1 disarankan.</p>
                  </div>
                </div>
              </div>

              {/* Category Name + Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide block mb-1.5">Nama Kategori *</label>
                  <input
                    type="text"
                    placeholder="contoh: Elektronik"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface border border-border-color rounded-xl text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide block mb-1.5">Kode *</label>
                  <input
                    type="text"
                    placeholder="contoh: ELEC"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-2.5 bg-surface border border-border-color rounded-xl text-[14px] text-text-primary font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              {/* Subcategories */}
              <div>
                <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide block mb-1.5">Subkategori</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Tambah subkategori..."
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubcategory(); } }}
                    className="flex-1 px-4 py-2.5 bg-surface border border-border-color rounded-xl text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={addSubcategory}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl hover:brightness-110 transition-all font-semibold text-[13px] flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Tambah
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-surface rounded-xl border border-border-color">
                  {form.subcategories.length === 0 ? (
                    <span className="text-[12px] text-text-tertiary italic">Belum ada subkategori.</span>
                  ) : (
                    form.subcategories.map((sub, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[12px] font-medium"
                      >
                        {sub}
                        <button type="button" onClick={() => removeSubcategory(idx)} className="hover:text-status-error transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-center gap-2 p-4 bg-status-error/10 border border-status-error/20 rounded-xl text-status-error text-[13px]">
                  <AlertCircle size={16} className="shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-black/5 bg-surface flex justify-between items-center">
              <button onClick={closeModal} className="px-5 py-2.5 text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors">
                Batal
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-6 py-2.5 rounded-full text-[14px] font-semibold bg-primary text-white shadow-[0_4px_12px_rgba(1,45,29,0.2)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
