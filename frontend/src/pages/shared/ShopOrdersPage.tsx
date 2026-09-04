import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { shopApi } from '@/api';
import { Loader2, Package, CheckCircle2, Clock, XCircle, Gift } from 'lucide-react';

interface Order {
  id: string;
  status: 'kutilmoqda' | 'berildi' | 'bekor_qilindi';
  priceAtOrder: number;
  createdAt: string;
  fulfilledAt: string | null;
  fulfilledByName: string | null;
  daysSinceOrder: number;
  student: { fullName: string; groupName: string | null; teacherName: string | null };
  item: { name: string; imageUrl: string | null; price: number };
}

const STATUS_META: Record<Order['status'], { label: string; color: string; icon: any }> = {
  kutilmoqda: { label: 'Kutilmoqda', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  berildi: { label: 'Berildi', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  bekor_qilindi: { label: 'Bekor qilindi', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
};

export default function ShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('kutilmoqda');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await shopApi.listOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleFulfill = async (order: Order) => {
    const ok = window.confirm(`"${order.item.name}" — ${order.student.fullName}ga berildimi?`);
    if (!ok) return;
    setBusyId(order.id);
    try {
      await shopApi.fulfillOrder(order.id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Xatolik');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order: Order) => {
    const note = window.prompt(`"${order.item.name}" buyurtmasini bekor qilish sababi (ixtiyoriy). Coin o'quvchiga qaytariladi.`);
    if (note === null) return;
    setBusyId(order.id);
    try {
      await shopApi.cancelOrder(order.id, note || undefined);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Xatolik');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Do'kon buyurtmalari" subtitle="O'quvchilar so'ragan sovg'alar" />

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            ['kutilmoqda', 'Kutilmoqda'],
            ['berildi', 'Berilgan'],
            ['bekor_qilindi', 'Bekor qilingan'],
            ['', 'Barchasi'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === val
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Bu bo'yicha buyurtma yo'q.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left px-5 py-3">O'quvchi</th>
                  <th className="text-left px-5 py-3">Guruh / O'qituvchi</th>
                  <th className="text-left px-5 py-3">Sovg'a</th>
                  <th className="text-left px-5 py-3">Narx</th>
                  <th className="text-left px-5 py-3">Necha kun</th>
                  <th className="text-left px-5 py-3">Holat</th>
                  <th className="text-left px-5 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = STATUS_META[o.status];
                  const Icon = meta.icon;
                  return (
                    <tr key={o.id} className="border-b border-zinc-900">
                      <td className="px-5 py-3 text-white font-medium">{o.student.fullName}</td>
                      <td className="px-5 py-3 text-zinc-400">
                        {o.student.groupName || '—'}
                        {o.student.teacherName && <span className="text-zinc-600"> · {o.student.teacherName}</span>}
                      </td>
                      <td className="px-5 py-3 text-zinc-300 flex items-center gap-2">
                        {o.item.imageUrl ? (
                          <img src={`${(import.meta.env.VITE_API_URL || '').replace('/api', '')}${o.item.imageUrl}`} className="w-8 h-8 rounded object-cover" alt="" />
                        ) : (
                          <Gift className="w-4 h-4 text-zinc-600" />
                        )}
                        {o.item.name}
                      </td>
                      <td className="px-5 py-3 text-amber-400 font-semibold">{o.priceAtOrder}</td>
                      <td className="px-5 py-3 text-zinc-400">{o.daysSinceOrder} kun</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${meta.color}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {o.status === 'kutilmoqda' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleFulfill(o)}
                              disabled={busyId === o.id}
                              className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold disabled:opacity-50"
                            >
                              Berildi
                            </button>
                            <button
                              onClick={() => handleCancel(o)}
                              disabled={busyId === o.id}
                              className="text-red-400 hover:text-red-300 text-xs font-semibold disabled:opacity-50"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">{o.fulfilledByName || '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
