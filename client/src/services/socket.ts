import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const envSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL || (import.meta as any).env?.VITE_API_URL;
    const socketUrl = envSocketUrl || window.location.origin;
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
