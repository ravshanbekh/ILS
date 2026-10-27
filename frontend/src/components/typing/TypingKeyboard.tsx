/**
 * Ekran klaviaturasi: keyingi bosiladigan tugma yorug'lanadi, tugmalar
 * barmoq bo'yicha rangda (CodeType KB/FG jadvallari asosida).
 */
const ROWS = [
  ['`~', '1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+'],
  ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'iI', 'oO', 'pP', '[{', ']}', '\\|'],
  ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', ';:', '\'"'],
  ['zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', ',<', '.>', '/?'],
];
const FINGER = [
  [0, 0, 1, 2, 3, 3, 4, 4, 5, 6, 7, 7, 7],
  [0, 1, 2, 3, 3, 4, 4, 5, 6, 7, 7, 7, 7],
  [0, 1, 2, 3, 3, 4, 4, 5, 6, 7, 7],
  [0, 1, 2, 3, 3, 4, 4, 5, 6, 7],
];
const FINGER_CLS = [
  'border-b-rose-500/60',
  'border-b-orange-500/60',
  'border-b-amber-500/60',
  'border-b-emerald-500/60',
  'border-b-sky-500/60',
  'border-b-indigo-500/60',
  'border-b-violet-500/60',
  'border-b-pink-500/60',
];

export default function TypingKeyboard({ next }: { next?: string }) {
  const needShift = !!next && ROWS.some((r) => r.some((k) => k[1] === next && k[0] !== next));
  const lit = (k: string) => !!next && (k[0] === next || k[1] === next);
  const key = (label: string, on: boolean, extra = '') => (
    <span
      className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md border border-zinc-800 border-b-2 px-1 text-[11px] font-mono transition-colors sm:h-9 sm:min-w-[2.4rem] ${
        on ? 'bg-orange-500 text-white border-orange-500' : 'bg-zinc-900 text-zinc-400'
      } ${extra}`}
    >
      {label}
    </span>
  );
  return (
    <div className="hidden select-none flex-col items-center gap-1 md:flex" aria-hidden>
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {ri === 1 && key('Tab', false, 'min-w-[3rem]')}
          {ri === 2 && key('Caps', false, 'min-w-[3.6rem]')}
          {ri === 3 && key('Shift', needShift, 'min-w-[4.4rem]')}
          {row.map((k, ci) => (
            <span key={k} className={lit(k) ? '' : FINGER_CLS[FINGER[ri][ci]]}>
              {key(/[a-z]/.test(k[0]) ? k[1] : k[0], lit(k), lit(k) ? '' : FINGER_CLS[FINGER[ri][ci]])}
            </span>
          ))}
          {ri === 0 && key('⌫', false, 'min-w-[3.6rem]')}
          {ri === 2 && key('Enter', next === '\n', 'min-w-[4rem]')}
          {ri === 3 && key('Shift', needShift, 'min-w-[4.4rem]')}
        </div>
      ))}
      <div className="flex">{key('space', next === ' ', 'min-w-[16rem]')}</div>
    </div>
  );
}
