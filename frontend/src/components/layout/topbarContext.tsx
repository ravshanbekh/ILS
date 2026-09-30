import { createContext, useContext } from 'react';
import type { TopbarProps } from './Topbar';

/**
 * Global topbar holati.
 *
 * Topbar (mavzu, bildirishnoma, akkaunt menyusi) AppLayout'da BITTA marta
 * chiziladi. Sahifalar faqat o'z sarlavhasini shu kontekst orqali uzatadi.
 *
 * Nega shunday: ilgari har bir sahifa topbar'ni o'zi chizardi
 * (`<Header title=... />`). 57 ta sahifadan 9 tasi buni qilmagan edi —
 * Darsliklar, Imtihonlar, Live Quiz, Cheklistlar, Prognozlar va boshqalar —
 * va ularda mavzu tugmasi, bildirishnomalar va akkaunt menyusi umuman
 * ko'rinmasdi. Endi topbar layout'ning bir qismi, uni unutib bo'lmaydi.
 *
 * Qo'shimcha foyda: har bir sahifaga o'tganda bildirishnomalar qayta
 * yuklanmaydi va socket'ga qayta ulanmaydi.
 */
export type TopbarState = Omit<TopbarProps, 'onMenuClick'>;

export interface TopbarContextValue {
  setTopbar: (state: TopbarState) => void;
}

export const TopbarContext = createContext<TopbarContextValue | null>(null);

export function useTopbarContext() {
  return useContext(TopbarContext);
}
