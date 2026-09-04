import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { shopApi, coinsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Coins, Gift, Loader2, Package, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  isActive: boolean;
}

interface MyOrder {
  id: string;
  status: 'kutilmoqda' | 'berildi' | 'bekor_qilindi';
  priceAtOrder: number;
  createdAt: string;
  item: { name: string; imageUrl: string | null };
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace('/api', '');

const STATUS_META: Record<MyOrder['status'], { label: string; color: string; icon: any }> = {
  kutilmoqda: { label: 'Kutilmoqda', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  berildi: { label: 'Berildi', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  bekor_qilindi: { label: 'Bekor qilindi', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
};

export default function ShopPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, ordersRes, balanceRes] = await Promise.all([
        shopApi.getItems(),
        shopApi.getMyOrders(),
        user?.id ? coinsApi.getBalance(user.id) : Promise.resolve({ data: { data: { balance: 0 } } } as any),
      ]);
      setItems(itemsRes.data.data);
      setOrders(ordersRes.data.data);
      setBalance(balanceRes.data.data.balance);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOrder = async (item: ShopItem) => {
    const ok = window.confirm(`"${item.name}" uchun ${item.price} coin sarflanadi. Buyurtma berasizmi?`);
    if (!ok) return;
    setOrderingId(item.id);
    try {
      await shopApi.createOrder(item.id);
      await load();
      alert("Buyurtma berildi! Kassirdan sovg'angizni olishingiz mumkin.");
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Buyurtma berishda xatolik');
    } finally {
      setOrderingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Do'kon" subtitle="Coiningizga sovg'a tanlang" />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Balans */}
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Coins className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400 font-medium mb-1">Balansingiz</p>
            <p className="text-3xl font-bold text-amber-400 tracking-tight">
              {balance === null ? <Loader2 className="w-6 h-6 animate-spin" /> : balance}
            </p>
          </div>
        </div>

        {/* Tovarlar */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Hozircha do'konda tovar yo'q.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => {
              const canAfford = (balance ?? 0) >= item.price;
              const outOfStock = item.stock !== null && item.stock <= 0;
              return (
                <div key={item.id} className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="h-40 bg-zinc-900 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={`${API_BASE}${item.imageUrl}`} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Gift className="w-10 h-10 text-zinc-700" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-white font-bold text-sm mb-1">{item.name}</h3>
                    {item.description && <p className="text-zinc-500 text-xs mb-3 flex-1">{item.description}</p>}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                        <Coins className="w-4 h-4" /> {item.price}
                      </span>
                      {outOfStock && <span className="text-xs text-red-400 font-medium">Tugagan</span>}
                    </div>
                    <button
                      onClick={() => handleOrder(item)}
                      disabled={!canAfford || outOfStock || orderingId === item.id}
                      className="mt-3 w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:cursor-not-allowed"
                    >
                      {orderingId === item.id ? 'Yuborilmoqda...' : outOfStock ? 'Tugagan' : !canAfford ? 'Coin yetarli emas' : 'Buyurtma berish'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mening buyurtmalarim */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h3 className="text-white font-bold text-sm">Mening buyurtmalarim</h3>
          </div>
          {orders.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">Hali buyurtma bermagansiz.</p>
          ) : (
            <div className="divide-y divide-zinc-900">
              {orders.map((o) => {
                const meta = STATUS_META[o.status];
                const Icon = meta.icon;
                return (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{o.item.name}</p>
                      <p className="text-zinc-500 text-xs">{new Date(o.createdAt).toLocaleDateString('uz-UZ')} · {o.priceAtOrder} coin</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${meta.color}`}>
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
