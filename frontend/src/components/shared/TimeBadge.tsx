import { Clock } from 'lucide-react';
import { formatDuration, formatSecondsExact } from '@/utils/duration';

/**
 * Normativ vaqti yorlig'i — barcha sahifalarda bir xil.
 *
 * Ilgari har sahifada o'zicha yozilgan edi va admin jadvalida oddiy inline
 * span bo'lgani uchun tor ustunda "30" va "sek" ikki qatorga bo'linib,
 * ramka ikki bo'lakka uzilardi. Bu yerda:
 *  - inline-flex + whitespace-nowrap — hech qachon bo'linmaydi;
 *  - tabular-nums — ustundagi raqamlar bir tekis turadi;
 *  - text-amber-400 — palitrada bu "o'qiladigan matn" shadesi (dark'da
 *    och oltin, light'da to'q jigarrang). amber-500 light rejimda oq fonda
 *    sariq bo'lib o'qilmasdi.
 */
export default function TimeBadge({
  seconds,
  size = 'sm',
}: {
  seconds: number | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!seconds || seconds <= 0) {
    return <span className="text-zinc-600 text-xs">—</span>;
  }
  const md = size === 'md';
  return (
    <span
      title={formatSecondsExact(seconds)}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/25 bg-amber-500/10 font-semibold tabular-nums text-amber-400 ${
        md ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-xs'
      }`}
    >
      <Clock className={md ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" />
      {formatDuration(seconds)}
    </span>
  );
}
