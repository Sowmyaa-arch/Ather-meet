import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const RENDER_BACKEND_URL = 'https://ather-meet.onrender.com';

export function getSocket(): Socket {
  if (!socket) {
    const envSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL || (import.meta as any).env?.VITE_API_URL;
    const socketUrl = envSocketUrl || RENDER_BACKEND_URL;
    socket = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
