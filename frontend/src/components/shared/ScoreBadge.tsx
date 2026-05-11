interface ScoreBadgeProps {
  result: 'green' | 'blue' | 'red' | string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ScoreBadge({ result, size = 'md', showLabel = false }: ScoreBadgeProps) {
  const sizeMap = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const badgeStyles = result === 'green'
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : result === 'blue'
    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    : result === 'red'
    ? 'bg-red-500/10 text-red-500 border-red-500/20'
    : 'bg-amber-500/10 text-amber-500 border-amber-500/20';

  const label = result === 'green'
    ? 'A\'lo (Yashil)'
    : result === 'blue'
    ? 'Yaxshi (Ko\'k)'
    : result === 'red'
    ? 'Qoniqarsiz (Qizil)'
    : 'Kutilmoqda';

  const emoji = result === 'green'
    ? '🟢'
    : result === 'blue'
    ? '🔵'
    : result === 'red'
    ? '🔴'
    : '⏳';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-semibold border ${sizeMap[size]} ${badgeStyles}`}>
      {!showLabel && <span>{emoji}</span>}
      {showLabel ? label : ''}
    </span>
  );
}
