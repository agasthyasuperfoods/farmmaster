'use client';

import { useEffect, useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  User, 
  Phone, 
  Calendar, 
  Loader2, 
  Info,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  ArrowUpDown,
  Trash2,
  FileText
} from 'lucide-react';
import { downloadOrderInvoice } from '@/src/utils/invoiceGenerator';

interface Customer {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
}

interface OrderItem {
  _id: string;
  product: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  customerId: Customer;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setOrders(result.data);
      } else {
        setError(result.error || 'Failed to fetch customer orders');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        await fetchOrders();
        // Update selected order modal if open
        if (selectedOrder && selectedOrder._id === id) {
          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        alert(result.error || 'Failed to update order status');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        await fetchOrders();
        if (selectedOrder && selectedOrder._id === id) {
          setSelectedOrder(null);
        }
      } else {
        alert(result.error || 'Failed to delete order');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    }
  };

  const filteredOrders = orders.filter(order => {
    const search = searchQuery.toLowerCase();
    const customer = order.customerId;
    const nameMatch = customer?.name?.toLowerCase().includes(search) || false;
    const phoneMatch = customer?.phone?.includes(search) || false;
    const orderNoMatch = order.orderNumber.toLowerCase().includes(search);
    
    const matchesSearch = nameMatch || phoneMatch || orderNoMatch;
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getOrderTotal = (order: Order) => {
    return order.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">Customer Orders</h1>
          <p className="text-slate-500 font-bold tracking-tight">Order pipelines and shipment tracking from mobile client app.</p>
        </div>
      </div>

      {/* Filter and stats bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-6 rounded-[24px]">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-[16px] text-slate-900 font-bold focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all text-sm shadow-inner"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-[16px] text-slate-700 font-bold focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Total Orders</span>
            <span className="text-2xl font-black text-slate-900">{orders.length}</span>
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
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Order No</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Mobile</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Total Items</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Total Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Ordered On</th>
                  <th className="text-left px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                      No customer orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-black text-slate-900">
                        #{order.orderNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-600 text-sm">
                            <User className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-black text-slate-900 block">
                            {order.customerId?.name || 'Anonymous User'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {order.customerId?.phone || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">
                        {order.items.reduce((total, item) => total + item.quantity, 0)} items
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        ₹{getOrderTotal(order).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border uppercase tracking-wider ${statusColors[order.status] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadOrderInvoice(order)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all uppercase tracking-wider shadow-sm hover:shadow"
                            title="Download / Print Invoice"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            Invoice
                          </button>
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all uppercase tracking-wider shadow-sm hover:shadow"
                          >
                            <Info className="w-3.5 h-3.5" />
                            Details
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order._id)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black text-red-700 bg-red-50 border border-red-100 hover:bg-red-100 transition-all uppercase tracking-wider shadow-sm hover:shadow"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xl" onClick={() => setSelectedOrder(null)} />
          
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 w-full max-w-4xl relative z-10 shadow-3xl animate-in slide-in-from-bottom-32 duration-500 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-slate-900 rounded-[20px] flex items-center justify-center shadow-3xl shadow-slate-900/40">
                  <ShoppingBag className="w-7 h-7 text-white" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                     Order #{selectedOrder.orderNumber}
                   </h2>
                   <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-[0.3em] font-black">Customer Invoice Pipeline</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all transform hover:rotate-90 duration-500"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-2">
              {/* Order summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Customer Profile</span>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">{selectedOrder.customerId?.name || 'Anonymous User'}</p>
                    <p className="text-xs text-slate-500 font-semibold">{selectedOrder.customerId?.phone}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Order Date & Total</span>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">₹{getOrderTotal(selectedOrder).toFixed(2)}</p>
                    <p className="text-xs text-slate-500 font-semibold">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Change Order Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={selectedOrder.status}
                      disabled={updatingId === selectedOrder._id}
                      onChange={(e) => handleUpdateStatus(selectedOrder._id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="customer_unavailable">Customer Unavailable</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {updatingId === selectedOrder._id && <Loader2 className="w-4 h-4 animate-spin text-slate-600" />}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-4">Ordered Products</h3>
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Product Name</th>
                        <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Unit Price</th>
                        <th className="text-center px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Qty</th>
                        <th className="text-right px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                          <td className="px-6 py-4 text-sm text-right font-medium text-slate-600">₹{item.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-center font-bold text-slate-800">{item.quantity}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => downloadOrderInvoice(selectedOrder)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <FileText className="w-4 h-4" />
                Download Invoice
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
