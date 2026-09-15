import Illustration from '@/components/brand/Illustration';
import type { IllustrationKey } from '@/components/brand/Illustration';
import BadgeIcon from '@/components/brand/BadgeIcon';

/**
 * ASSET TEKSHIRUV GALEREYASI — faqat dev rejimida.
 *
 * Har bir kerakli 3D fayl o'z uyasida ko'rsatiladi. Fayl yo'q bo'lsa
 * vaqtinchalik belgi (yoki emoji) chiqadi — ya'ni bu sahifa ayni paytda
 * "nima yetishmayapti" ro'yxati vazifasini ham bajaradi.
 *
 * Fayllarni qo'yganingizdan keyin shu sahifani ochib, sakkiztasi bir xil
 * yorug'lik va masshtabda ko'rinayotganini tekshiring.
 */

const PANEL_ASSETS: { key: IllustrationKey; label: string; where: string }[] = [
  { key: 'student', label: "O'quvchilar", where: 'Admin KPI' },
  { key: 'teacher', label: "O'qituvchilar", where: 'Admin KPI' },
  { key: 'groups', label: 'Guruhlar', where: 'Admin KPI' },
  { key: 'standards', label: 'Normativlar', where: 'Admin KPI' },
  { key: 'assignments', label: 'Jami topshiriqlar', where: 'Admin KPI' },
  { key: 'checked', label: 'Tekshirilgan', where: 'Admin KPI' },
  { key: 'pending', label: 'Kutilmoqda', where: 'Admin KPI' },
  { key: 'hero-education', label: 'Banner', where: 'Admin intro' },
  { key: 'student-hero', label: 'Profil hero', where: "O'quvchi kabineti" },
  { key: 'coins', label: 'Coinlar', where: "O'quvchi kabineti" },
];

/** Backenddagi badge ro'yxati bilan bir xil tartibda (statistics.service.ts) */
const BADGES: { id: string; emoji: string; label: string }[] = [
  { id: 'first_green', emoji: '🟢', label: "Ilk G'alaba" },
  { id: 'perfect_10', emoji: '🥇', label: "A'lochi" },
  { id: 'century', emoji: '💯', label: 'Yuzlik' },
  { id: 'double_century', emoji: '🏆', label: '200 lik Klub' },
  { id: 'triple_century', emoji: '👑', label: 'Spartalik' },
  { id: 'dragon', emoji: '🐉', label: 'Ajdarho' },
  { id: 'multitasker', emoji: '🎓', label: "Ko'p qirrali" },
  { id: 'night_owl', emoji: '🦉', label: "Tungi boyo'g'li" },
  { id: 'rainbow', emoji: '🌈', label: 'Kamalak' },
  { id: 'sniper', emoji: '🎯', label: 'Snayper' },
  { id: 'comeback', emoji: '🚑', label: "O'likdan tirilgan" },
  { id: 'rocket', emoji: '🚀', label: 'Raketa' },
  { id: 'streak_5', emoji: '🔥', label: 'Olovli' },
];

function Slot({ children, title, note }: { children: React.ReactNode; title: string; note: string }) {
  return (
    <li
      className="flex flex-col items-center rounded-2xl border px-3 py-4 text-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-[96px] items-center justify-center">{children}</div>
      <p className="mt-2 text-sm font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {note}
      </p>
    </li>
  );
}

export default function AssetChecklist() {
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-xl font-semibold">Asset tekshiruvi</h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Uzuq-chiziqli kvadrat yoki emoji ko'rinsa — o'sha fayl hali qo'yilmagan.
        Promptlar: <code>design/it-live-score/ASSET-PROMPTS.md</code>
      </p>

      <h3 className="mb-2 mt-6 font-semibold">Panel illustratsiyalari — public/illustrations/</h3>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-5">
        {PANEL_ASSETS.map((a) => (
          <Slot key={a.key} title={`${a.key}.webp`} note={`${a.label} · ${a.where}`}>
            <Illustration name={a.key} size={88} />
          </Slot>
        ))}
      </ul>

      <h3 className="mb-2 mt-8 font-semibold">Yutuq ikonkalari — public/illustrations/badges/</h3>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-5">
        {BADGES.map((b) => (
          <Slot key={b.id} title={`${b.id}.webp`} note={b.label}>
            <BadgeIcon badgeId={b.id} emoji={b.emoji} size={84} />
          </Slot>
        ))}
      </ul>
    </section>
  );
}
