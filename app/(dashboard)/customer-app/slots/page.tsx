'use client';

import { useEffect, useState } from 'react';
import { 
  Clock, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  X, 
  Save, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface DeliverySlot {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  cutoffTime?: string;
  description?: string;
  displayOrder: number;
  maxOrdersPerDay: number;
  enabled: boolean;
  createdAt: string;
}

export default function DeliverySlotsPage() {
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DeliverySlot | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    cutoffTime: '',
    description: '',
    displayOrder: 1,
    maxOrdersPerDay: 0,
    enabled: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState({ type: '', text: '' });

  const fetchSlots = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/delivery-slots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setSlots(result.data);
      } else {
        setError(result.error || 'Failed to fetch delivery slots');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSlot(null);
    setFormData({
      name: '',
      startTime: '05:30 AM',
      endTime: '07:30 AM',
      cutoffTime: '10:00 PM',
      description: '',
      displayOrder: (slots.length + 1),
      maxOrdersPerDay: 0,
      enabled: true,
    });
    setModalMessage({ type: '', text: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (slot: DeliverySlot) => {
    setEditingSlot(slot);
    setFormData({
      name: slot.name || '',
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      cutoffTime: slot.cutoffTime || '',
      description: slot.description || '',
      displayOrder: slot.displayOrder || 0,
      maxOrdersPerDay: slot.maxOrdersPerDay || 0,
      enabled: slot.enabled ?? true,
    });
    setModalMessage({ type: '', text: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const url = editingSlot 
        ? `/api/admin/delivery-slots/${editingSlot._id}`
        : '/api/admin/delivery-slots';
      const method = editingSlot ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      if (result.success) {
        setModalMessage({ 
          type: 'success', 
          text: editingSlot ? 'Delivery slot updated successfully!' : 'Delivery slot created successfully!' 
        });
        await fetchSlots();
        setTimeout(() => setIsModalOpen(false), 1200);
      } else {
        setModalMessage({ type: 'error', text: result.error || 'Failed to save delivery slot' });
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'An unexpected error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/delivery-slots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        await fetchSlots();
      } else {
        alert(result.error || 'Failed to delete slot');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    }
  };

  const handleToggleEnabled = async (slot: DeliverySlot) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/delivery-slots/${slot._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !slot.enabled })
      });
      const result = await res.json();
      if (result.success) {
        await fetchSlots();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const filteredSlots = slots.filter((slot) => {
    const search = searchQuery.toLowerCase();
    return (
      slot.name.toLowerCase().includes(search) ||
      slot.startTime.toLowerCase().includes(search) ||
      slot.endTime.toLowerCase().includes(search) ||
      (slot.description && slot.description.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">Delivery Slots</h1>
          <p className="text-slate-500 font-bold tracking-tight">
            Define and manage delivery time windows available to mobile app customers.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/25 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Slot
        </button>
      </div>

      {/* Stats and Search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-6 rounded-[24px]">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search slot name, time, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-[16px] text-slate-900 font-bold focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all text-sm shadow-inner"
          />
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Active Slots</span>
            <span className="text-2xl font-black text-blue-600">
              {slots.filter(s => s.enabled).length} / {slots.length}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-[20px] font-bold text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-slate-900 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-[32px] text-slate-400 font-bold">
              No delivery slots found. Click "+ Add Slot" to create one.
            </div>
          ) : (
            filteredSlots.map((slot) => (
              <div 
                key={slot._id}
                className={`bg-white border rounded-[28px] p-6 transition-all relative flex flex-col justify-between ${
                  slot.enabled 
                    ? 'border-slate-200 shadow-sm hover:shadow-md' 
                    : 'border-slate-200/60 bg-slate-50/50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      Order: {slot.displayOrder}
                    </span>
                    <button
                      onClick={() => handleToggleEnabled(slot)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all ${
                        slot.enabled 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {slot.enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {slot.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">{slot.name}</h3>
                      <p className="text-xs font-bold text-blue-600">
                        {slot.startTime} &mdash; {slot.endTime}
                      </p>
                    </div>
                  </div>

                  {slot.description && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4">
                      {slot.description}
                    </p>
                  )}

                  {slot.cutoffTime && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 text-xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Order Cutoff Time</span>
                      <span className="font-bold text-slate-800">{slot.cutoffTime}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">
                    {slot.maxOrdersPerDay > 0 ? `Max: ${slot.maxOrdersPerDay} orders` : 'Unlimited orders'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(slot)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                      title="Edit Slot"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(slot._id, slot.name)}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                      title="Delete Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xl" onClick={() => setIsModalOpen(false)} />
          
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 w-full max-w-xl relative z-10 shadow-3xl animate-in slide-in-from-bottom-32 duration-500 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-600/30 text-white">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingSlot ? 'Edit Delivery Slot' : 'Add Delivery Slot'}
                  </h2>
                  <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-black">
                    Time Window Definition
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage.text && (
              <div className={`mb-6 p-4 rounded-[20px] flex items-center gap-3 shadow-sm border shrink-0 ${
                modalMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}>
                {modalMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {modalMessage.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                <p className="font-black text-sm">{modalMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Slot Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Morning Slot, Evening Slot"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    placeholder="e.g. 05:30 AM"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    placeholder="e.g. 07:30 AM"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Cutoff Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cutoffTime}
                    onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                    placeholder="e.g. 10:00 PM"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    placeholder="1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Early morning delivery for fresh milk before 7:30 AM"
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] px-4 py-3 text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all text-sm"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-800">
                    Enable this delivery slot for customer ordering
                  </span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-blue-500/25 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingSlot ? 'Save Changes' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
