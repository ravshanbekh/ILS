import { create } from 'zustand';

interface User {
  id: string;
  fullName: string;
  login: string;
  role: 'admin' | 'teacher' | 'student' | 'filial_rahbari' | 'assistant' | 'moliya_rahbari' | 'kassir' | 'administrator' | 'nazoratchi' | 'hr_rahbari' | 'sotuv_operatori' | 'farrosh' | 'robototexnika_ustoz' | 'call_operatori';
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // LocalStorage dan yuklash
  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('accessToken');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    accessToken: storedToken || null,
    isAuthenticated: !!storedToken,

    login: (user, accessToken, refreshToken) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      set({ user, accessToken, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, accessToken: null, isAuthenticated: false });
    },

    setUser: (user) => {
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    },
  };
});
