import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useNotificationStore } from '../store/notificationStore';

const TOKEN_KEY = 'franclean-token';

let globalSocket: Socket | null = null;

function getSocket(): Socket | null {
  return globalSocket;
}

/**
 * Central hook that connects to Socket.IO and wires up
 * real-time store refreshes.  Mount once in the root layout.
 */
export function useSocket() {
  const connectedRef = useRef(false);
  const { isAuthenticated } = useAuthStore();

  // Stable refs to store actions (avoid re-running effect when stores change)
  const fetchEventsRef = useRef(useEventStore.getState().fetchEvents);
  const fetchRecordsRef = useRef(useAttendanceStore.getState().fetchRecords);
  const fetchUsersRef = useRef(useAuthStore.getState().fetchUsers);

  useEffect(() => {
    fetchEventsRef.current = useEventStore.getState().fetchEvents;
    fetchRecordsRef.current = useAttendanceStore.getState().fetchRecords;
    fetchUsersRef.current = useAuthStore.getState().fetchUsers;
  });

  useEffect(() => {
    if (!isAuthenticated) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        connectedRef.current = false;
      }
      return;
    }

    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;

    // Prevent duplicate connections
    if (globalSocket?.connected || connectedRef.current) return;
    connectedRef.current = true;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    globalSocket = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      // Fresh fetch on (re)connect to sync up
      fetchEventsRef.current();
      fetchRecordsRef.current();
      fetchUsersRef.current();
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    // ── Real-time data refresh listeners ──────────────────
    socket.on('events:changed', () => {
      console.log('📡 events:changed received');
      fetchEventsRef.current();
    });

    socket.on('attendance:changed', () => {
      console.log('📡 attendance:changed received');
      fetchRecordsRef.current();
    });

    socket.on('users:changed', () => {
      console.log('📡 users:changed received');
      fetchUsersRef.current();
    });

    socket.on('notification:agentResponse', (data: any) => {
      console.log('📡 Agent response notification:', data);
    });

    socket.on('notification:newAttendance', (data: any) => {
      console.log('📡 New attendance notification:', data);
    });

    return () => {
      socket.disconnect();
      globalSocket = null;
      connectedRef.current = false;
    };
  }, [isAuthenticated]);

  // Regenerate notifications whenever store data changes
  useEffect(() => {
    const unsub = useEventStore.subscribe(() => regenerateNotifications());
    const unsub2 = useAttendanceStore.subscribe(() => regenerateNotifications());
    const unsub3 = useAuthStore.subscribe(() => regenerateNotifications());
    return () => { unsub(); unsub2(); unsub3(); };
  }, []);

  return globalSocket;
}

function regenerateNotifications() {
  const { events } = useEventStore.getState();
  const { records } = useAttendanceStore.getState();
  const { users } = useAuthStore.getState();
  const { generateNotifications } = useNotificationStore.getState();
  if (users.length > 0 || events.length > 0 || records.length > 0) {
    generateNotifications(events, records, users);
  }
}

export { getSocket };
