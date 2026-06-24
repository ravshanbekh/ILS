import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { predictionsApi } from '@/api';
import {
  TrendingDown, AlertTriangle, Users, DollarSign, BarChart3,
  ChevronDown, ChevronUp, Brain, Loader2, RefreshCw, ArrowUpRight
} from 'lucide-react';

type RiskLevel = 'high' | 'medium' | 'low';

const RISK_LABELS: Record<RiskLevel, { label: string; color: string; bg: string; dot: string }> = {
  high: { label: 'Yuqori xavf', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
  medium: { label: "O'rtacha xavf", color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' },
  low: { label: 'Past xavf', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' },
};

function RiskBar({ value, max = 99 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-7 text-right ${
        value >= 70 ? 'text-red-400' : value >= 40 ? 'text-amber-400' : 'text-emerald-400'
      }`}>{value}%</span>
    </div>
  );
}

export default function PredictionsPage() {
  const [filter, setFilter] = useState<'all' | RiskLevel>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: dropoutData,
    isLoading: dropoutLoading,
    refetch: refetchDropout,
    isRefetching: dropoutRefetching,
  } = useQuery({
    queryKey: ['predictions-dropout'],
    queryFn: () => predictionsApi.getDropout().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: revenueData,
    isLoading: revenueLoading,
    refetch: refetchRevenue,
    isRefetching: revenueRefetching,
  } = useQuery({
    queryKey: ['predictions-revenue'],
    queryFn: () => predictionsApi.getRevenue().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = (dropoutData?.predictions || []).filter(
    (p: any) => filter === 'all' || p.riskLevel === filter
  );

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('uz-UZ').format(n) + ' so\'m';

  const TREND_LABELS: Record<string, string> = {
    increasing: '📈 Muzlatish soni oshmoqda',
    decreasing: '📉 Muzlatish soni kamaymoqda',
    stable: '➡️ Barqaror holat',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-violet-400" />
            AI Prognozlar
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            O'quvchi ketish xavfi va daromad prognozi
          </p>
        </div>
        <button
          onClick={() => { refetchDropout(); refetchRevenue(); }}
          disabled={dropoutRefetching || revenueRefetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm border border-zinc-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(dropoutRefetching || revenueRefetching) ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      {/* Summary cards — Dropout */}
      {dropoutLoading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Dropout prognozi yuklanmoqda...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Jami o'quvchilar", value: dropoutData?.summary?.total || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Yuqori xavf', value: dropoutData?.summary?.high || 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
              { label: "O'rtacha xavf", value: dropoutData?.summary?.medium || 0, icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Past xavf', value: dropoutData?.summary?.low || 0, icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map(card => (
              <div key={card.label} className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'high', 'medium', 'low'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  filter === f
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                {f === 'all' ? `Barchasi (${dropoutData?.summary?.total || 0})`
                  : f === 'high' ? `⚠️ Yuqori (${dropoutData?.summary?.high || 0})`
                  : f === 'medium' ? `🔶 O'rtacha (${dropoutData?.summary?.medium || 0})`
                  : `✅ Past (${dropoutData?.summary?.low || 0})`}
              </button>
            ))}
          </div>

          {/* Student dropout risk list */}
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <h2 className="text-white font-semibold text-sm">O'quvchi Ketish Xavfi Prognozi</h2>
              <span className="ml-auto text-xs text-zinc-500">{filtered.length} ta o'quvchi</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">
                Bu toifada o'quvchilar yo'q
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filtered.map((p: any) => {
                  const rl = RISK_LABELS[p.riskLevel as RiskLevel];
                  const isExpanded = expandedId === p.studentId;
                  return (
                    <div key={p.studentId} className="transition-colors hover:bg-zinc-800/30">
                      <button
                        className="w-full px-5 py-3.5 flex items-center gap-4 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : p.studentId)}
                      >
                        {/* Risk dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${rl.dot}`} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-medium truncate">{p.studentName}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${rl.bg} ${rl.color}`}>
                              {rl.label}
                            </span>
                          </div>
                          <p className="text-zinc-500 text-xs mt-0.5 truncate">
                            {p.groupName} · {p.teacherName}
                          </p>
                        </div>

                        {/* Risk bar */}
                        <div className="w-32 shrink-0 hidden sm:block">
                          <RiskBar value={p.risk} />
                        </div>

                        {/* Expand icon */}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                      </button>

                      {/* Expanded factors */}
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-1">
                          <div className="sm:hidden mb-2">
                            <RiskBar value={p.risk} />
                          </div>
                          <p className="text-xs text-zinc-400 mb-2 font-medium">Xavf omillari:</p>
                          <ul className="space-y-1.5">
                            {p.factors.map((f: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                          {p.factors.length === 0 && (
                            <p className="text-xs text-zinc-500">Hech qanday xavf omili aniqlanmadi</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Revenue Forecasting */}
      {revenueLoading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Daromad prognozi yuklanmoqda...
        </div>
      ) : revenueData ? (
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold text-sm">Daromad Prognozi (3 Oy)</h2>
            <span className="ml-auto text-xs text-zinc-400">
              {TREND_LABELS[revenueData.trend] || revenueData.trend}
            </span>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-zinc-800 border-b border-zinc-800">
            {[
              { label: "Faol o'quvchilar", value: revenueData.activeStudents, suffix: ' ta' },
              { label: "Oylik to'lov", value: formatMoney(revenueData.monthlyFee), suffix: '' },
              { label: "O'rtacha muzlatish/oy", value: revenueData.summary.avgMonthlyFreeze, suffix: ' ta' },
              { label: "Maks. prognoz yo'qotish", value: formatMoney(revenueData.summary.maxForecastLoss), suffix: '' },
            ].map(item => (
              <div key={item.label} className="p-4">
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="text-base font-bold text-white mt-0.5">
                  {typeof item.value === 'number' ? item.value + item.suffix : item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Forecast cards */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {revenueData.forecast.map((f: any) => (
              <div key={f.monthsAhead} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">+{f.monthsAhead} oy</p>
                  <ArrowUpRight className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-zinc-500">Prognoz muzlatish</p>
                    <p className="text-lg font-bold text-amber-400">{f.projectedFrozen} ta</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Potentsial yo'qotish</p>
                    <p className="text-sm font-semibold text-red-400">{formatMoney(f.potentialLoss)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Qaytarib olish imkoni</p>
                    <p className="text-sm font-semibold text-emerald-400">{formatMoney(f.recoverableRevenue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Historical chart bars */}
          <div className="px-5 pb-5">
            <p className="text-xs text-zinc-500 mb-3 font-medium">Oxirgi 6 oy muzlatish tarixi</p>
            <div className="flex items-end gap-2 h-24">
              {revenueData.history.map((h: any) => {
                const maxFreeze = Math.max(...revenueData.history.map((x: any) => x.frozenCount), 1);
                const height = Math.round((h.frozenCount / maxFreeze) * 100);
                return (
                  <div key={`${h.year}-${h.month}`} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500/70 rounded-t-sm transition-all hover:bg-blue-400"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${h.frozenCount} ta`}
                    />
                    <p className="text-[10px] text-zinc-600 text-center leading-tight">
                      {h.month}/{h.year % 100}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
