import { ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from 'lucide-react';
import type { DeltaResult } from '@/utils/delta';

interface TrendBadgeProps {
  delta: DeltaResult;
  /** Badge tagidagi izoh matni (masalan "O'tgan oyga nisbatan") */
  caption?: string;
  className?: string;
}

/**
 * DESIGN-GUIDE 7-bo'lim.
 *
 * Rang yo'nalishni bildiradi (o'sish — oltin, pasayish — qizil), LEKIN
 * "yaxshi/yomon" ma'nosini bildirmaydi. Shuning uchun badge'da strelka
 * (shakl) ham bor va tooltipda to'liq izoh beriladi — rang yagona
 * informatsiya manbai bo'lib qolmasligi uchun.
 */
export default function TrendBadge({ delta, caption, className = '' }: TrendBadgeProps) {
  const { direction, label, description } = delta;

  const Icon =
    direction === 'up' ? ArrowUpRight
    : direction === 'down' ? ArrowDownRight
    : direction === 'flat' ? Minus
    : HelpCircle;

  // Ranglar index.css tokenlaridan — theme almashganda o'zi moslashadi
  const tone =
    direction === 'up'
      ? { background: 'var(--trend-up-bg)', color: 'var(--trend-up-fg)' }
      : direction === 'down'
      ? { background: 'var(--trend-down-bg)', color: 'var(--trend-down-fg)' }
      : { background: 'var(--surface-muted)', color: 'var(--muted-foreground)' };

  return (
    <div className={className}>
      {caption && (
        <p className="text-sm leading-5 mb-2" style={{ color: 'var(--muted-foreground)' }}>
          {caption}
        </p>
      )}
      <span
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-base font-semibold tabular"
        style={tone}
        title={description}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        {/* Ekran o'quvchi uchun to'liq ma'no — faqat rang/strelkaga tayanmaydi */}
        <span className="sr-only">{description}</span>
      </span>
    </div>
  );
}
