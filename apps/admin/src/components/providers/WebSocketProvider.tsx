'use client';

import { adminConfig } from '@/config/app.config';
import { useAppDispatch, useAppSelector } from '@/store';
import { addAlert, updateAlert } from '@/store/slices/alertsSlice';
import { addAuditLog, addSecurityEvent } from '@/store/slices/auditSlice';
import { addLogEntry, updateServiceHealth, updateSystemMetrics } from '@/store/slices/monitoringSlice';
import { addNotification, setConnectionStatus } from '@/store/slices/uiSlice';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);
  const { realTimeEnabled } = useAppSelector((state) => state.ui);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token || !realTimeEnabled) return;

    // Don't create multiple connections
    if (socketRef.current?.connected) return;

    dispatch(setConnectionStatus('connecting'));

    const socket = io(adminConfig.notifications.websocket.url, {
      auth: {
        token,
      },
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: true,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      dispatch(setConnectionStatus('connected'));
      reconnectAttemptsRef.current = 0;
      
      // Join admin room for admin-specific events
      socket.emit('join-admin-room');
      
      dispatch(addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Real-time updates are now active',
      }));
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      dispatch(setConnectionStatus('disconnected'));
      
      // Only show notification if it wasn't a manual disconnect
      if (reason !== 'io client disconnect') {
        dispatch(addNotification({
          type: 'warning',
          title: 'Connection Lost',
          message: 'Attempting to reconnect...',
        }));
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      dispatch(setConnectionStatus('disconnected'));
      
      // Implement exponential backoff for reconnection
      const maxAttempts = adminConfig.notifications.websocket.maxReconnectAttempts;
      const baseDelay = adminConfig.notifications.websocket.reconnectInterval;
      
      if (reconnectAttemptsRef.current < maxAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        dispatch(addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: 'Unable to establish real-time connection. Please refresh the page.',
        }));
      }
    });

    // System monitoring events
    socket.on('system-metrics', (data) => {
      dispatch(updateSystemMetrics(data));
    });

    socket.on('service-health', (data) => {
      dispatch(updateServiceHealth(data));
    });

    socket.on('log-entry', (data) => {
      dispatch(addLogEntry(data));
    });

    // Alert events
    socket.on('alert-created', (data) => {
      dispatch(addAlert(data));
      
      // Show notification for critical alerts
      if (data.severity === 'critical') {
        dispatch(addNotification({
          type: 'error',
          title: 'Critical Alert',
          message: data.title,
        }));
      }
    });

    socket.on('alert-updated', (data) => {
      dispatch(updateAlert(data));
    });

    // Audit events
    socket.on('audit-log', (data) => {
      dispatch(addAuditLog(data));
    });

    socket.on('security-event', (data) => {
      dispatch(addSecurityEvent(data));
      
      // Show notification for high/critical security events
      if (['high', 'critical'].includes(data.severity)) {
        dispatch(addNotification({
          type: 'error',
          title: 'Security Event',
          message: `${data.type}: ${data.details.message || 'Security event detected'}`,
        }));
      }
    });

    // User management events
    socket.on('user-created', (data) => {
      dispatch(addNotification({
        type: 'info',
        title: 'New User',
        message: `User ${data.email} has been created`,
      }));
    });

    socket.on('user-updated', (data) => {
      dispatch(addNotification({
        type: 'info',
        title: 'User Updated',
        message: `User ${data.email} has been updated`,
      }));
    });

    // System events
    socket.on('system-maintenance', (data) => {
      dispatch(addNotification({
        type: 'warning',
        title: 'System Maintenance',
        message: data.message,
      }));
    });

    socket.on('system-update', (data) => {
      dispatch(addNotification({
        type: 'info',
        title: 'System Update',
        message: data.message,
      }));
    });

    // Broadcast messages from other admins
    socket.on('admin-broadcast', (data) => {
      dispatch(addNotification({
        type: 'info',
        title: data.title,
        message: data.message,
      }));
    });

    // Handle server-sent notifications
    socket.on('notification', (data) => {
      dispatch(addNotification(data));
    });

  }, [dispatch, isAuthenticated, token, realTimeEnabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    dispatch(setConnectionStatus('disconnected'));
  }, [dispatch]);

  // Connect/disconnect based on auth state and real-time preference
  useEffect(() => {
    if (isAuthenticated && realTimeEnabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, realTimeEnabled, connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we might want to reduce update frequency
        // or pause non-critical updates
      } else {
        // Page is visible, resume normal operation
        if (isAuthenticated && realTimeEnabled && !socketRef.current?.connected) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, realTimeEnabled, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return <>{children}</>;
}