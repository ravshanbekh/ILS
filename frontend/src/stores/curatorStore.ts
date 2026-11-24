import { create } from 'zustand';
import { curatorApi } from '@/api';

/**
 * O'quvchining kuratori bormi — menyudagi "Kuratorim" bandi faqat shunda
 * ko'rinadi. Bir marta so'raladi (Sidebar va CategorySubHeader ulashadi).
 */
interface CuratorFlagState {
  hasCurator: boolean;
  loadedFor: string | null;
  load: (userId: string) => void;
}

export const useCuratorFlag = create<CuratorFlagState>((set, get) => ({
  hasCurator: false,
  loadedFor: null,
  load: (userId) => {
    if (get().loadedFor === userId) return;
    set({ loadedFor: userId });
    curatorApi
      .me()
      .then((r) => set({ hasCurator: !!r.data.data.enrollment }))
      .catch(() => set({ hasCurator: false }));
  },
}));
