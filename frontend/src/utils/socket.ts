import { io } from 'socket.io-client';

// 'http://localhost:3000' is the backend server running address
// But wait, the API_URL might be different in production. We can get the base URL from env or fallback to localhost:3000.
// Let's use the current window location host for production, or localhost:3000 for development.
const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});
