import { create } from 'zustand';
import { permissionsApi } from '@/api';

/**
 * Joriy foydalanuvchining qo'lda berilgan ruxsatlari.
 *
 * Tugmalarni ko'rsatish/yashirish uchun ishlatiladi. Bu faqat qulaylik uchun —
 * haqiqiy himoya baribir backendda (permissionGuard), shuning uchun bu yerdagi
 * ma'lumot eskirib qolsa ham xavfsizlik buzilmaydi: server baribir rad etadi.
 */
interface PermissionState {
  permissions: string[];
  isAdmin: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  reset: () => void;
  /** Ruxsat bormi? Admin uchun har doim true */
  can: (permission: string) => boolean;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  isAdmin: false,
  loaded: false,

  fetch: async () => {
    try {
      const res = await permissionsApi.getMine();
      set({
        permissions: res.data.data.permissions || [],
        isAdmin: !!res.data.data.isAdmin,
        loaded: true,
      });
    } catch {
      // Xato bo'lsa ruxsatlarsiz davom etamiz — server baribir tekshiradi
      set({ permissions: [], isAdmin: false, loaded: true });
    }
  },

  reset: () => set({ permissions: [], isAdmin: false, loaded: false }),

  can: (permission: string) => {
    const { isAdmin, permissions } = get();
    return isAdmin || permissions.includes(permission);
  },
}));
