'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

interface SessionMonitorProps {
  userId: string;
  inactivityTimeout?: number; // milliseconds (default: 10 min)
}

export default function SessionMonitor({ 
  userId, 
  inactivityTimeout = 10 * 60 * 1000 // 10 minutes default
}: SessionMonitorProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Reset inactivity timer
  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Show warning 2 minutes before logout
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
    }, inactivityTimeout - 2 * 60 * 1000); // Warning 2 min before

    // Auto-logout after inactivity
    timeoutRef.current = setTimeout(async () => {
      await handleLogout('inactivity');
    }, inactivityTimeout);

    // Log activity for AI anomaly detection
    logActivity('user_active');
  };

  // Handle logout
  const handleLogout = async (reason: 'inactivity' | 'manual') => {
    try {
      // Log logout event for audit
      await logActivity('session_ended', { reason });

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Force clear all cookies and storage
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
      localStorage.clear();
      sessionStorage.clear();

      // Use replace instead of push to prevent back button
      window.location.replace(`/?session=expired&reason=${reason}`);
    } catch (error) {
      console.error('Logout error:', error);
      window.location.replace('/');
    }
  };

  // Log activity for AI monitoring
  const logActivity = async (action: string, metadata?: any) => {
    try {
      const activityData = {
        user_id: userId,
        action,
        timestamp: new Date().toISOString(),
        path: window.location.pathname,
        user_agent: navigator.userAgent,
        metadata: metadata || {},
      };

      // Send to audit endpoint (will be monitored by AI)
      await fetch('/api/audit/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData),
      });
    } catch (error) {
      // Non-critical - fail silently
      console.warn('Activity logging failed:', error);
    }
  };

  // Keep session alive with activity
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle reset to avoid excessive calls
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetTimer();
          throttleTimer = null;
        }, 5000); // Max once per 5 seconds
      }
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, throttledReset);
    });

    // Initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [userId, inactivityTimeout]);

  // Monitor session validity
  useEffect(() => {
    const checkSession = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // Session invalid - logout
        await handleLogout('inactivity');
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkSession);
  }, [userId]);

  // Warning modal
  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-yellow-500/50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-yellow-500 text-6xl mb-4 text-center">⏰</div>
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
          Sesión por Expirar
        </h2>
        <p className="text-gray-400 mb-6 text-center">
          Tu sesión está a punto de expirar por inactividad. 
          ¿Deseas continuar trabajando?
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={() => {
              resetTimer();
              logActivity('session_extended');
            }}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-500 rounded-lg font-semibold hover:from-green-700 hover:to-teal-600 transition"
          >
            Continuar Sesión
          </button>
          <button
            onClick={() => handleLogout('manual')}
            className="flex-1 px-6 py-3 border border-gray-700 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Cerrar Sesión
          </button>
        </div>

        <p className="text-gray-500 text-sm mt-4 text-center">
          🔒 Política de seguridad: Auto-logout después de 10 minutos de inactividad
        </p>
      </div>
    </div>
  );
}
