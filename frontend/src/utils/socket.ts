import { io } from 'socket.io-client';

// Productionda sayt bilan bir xil origin; dev'da VITE_API_URL dan olinadi.
const SOCKET_URL = (import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : '') || window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  // Funksiya sifatida beriladi — har qayta ulanishda QAYTA o'qiladi.
  // Obyekt bo'lsa birinchi ulanishdagi (eskirgan) token qotib qolardi.
  auth: (cb) => cb({ token: localStorage.getItem('accessToken') || '' }),
});
