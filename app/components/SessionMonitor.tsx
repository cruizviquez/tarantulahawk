'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient'

interface SessionMonitorProps {
  userId: string
  inactivityTimeout?: number
}

export default function SessionMonitor({ 
  userId, 
  inactivityTimeout
}: SessionMonitorProps) {
  // Determine effective timeout, allowing env var to control default when prop omitted
  const envTimeoutRaw = typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_SESSION_INACTIVITY_TIMEOUT : undefined
  const envTimeout = envTimeoutRaw ? Number(envTimeoutRaw) : undefined
  const effectiveTimeout = inactivityTimeout !== undefined
    ? inactivityTimeout
    : (envTimeout && envTimeout > 0 ? envTimeout : Number.POSITIVE_INFINITY)
  const lastActivityRef = useRef<number>(Date.now())
  const warningShownRef = useRef<boolean>(false)
  const [showWarning, setShowWarning] = useState(false)
  const lastHeartbeatSentRef = useRef<number>(0)

  const WARNING_TIME = 2 * 60 * 1000

  const sendHeartbeat = async () => {
    try {
      // Throttle heartbeats to once per 60s
      const now = Date.now()
      if (now - lastHeartbeatSentRef.current < 60 * 1000) return
      lastHeartbeatSentRef.current = now
      await fetch('/api/heartbeat', { method: 'POST', credentials: 'same-origin' })
    } catch {}
  }

  const handleActivity = () => {
    lastActivityRef.current = Date.now()
    warningShownRef.current = false
    setShowWarning(false)
    // Update server-side last-activity
    void sendHeartbeat()
  }

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut()
      localStorage.clear()
      sessionStorage.clear()
      window.location.replace('/')
    } catch (error) {
      window.location.replace('/')
    }
  }

  useEffect(() => {
    // If monitoring disabled, do nothing
    if (!Number.isFinite(effectiveTimeout) || effectiveTimeout <= 0) {
      return
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Initial heartbeat on mount (session active)
    void sendHeartbeat()

    const checkInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityRef.current
      if (inactiveTime >= effectiveTimeout - WARNING_TIME && !warningShownRef.current) {
        setShowWarning(true)
        warningShownRef.current = true
      }
      if (inactiveTime >= effectiveTimeout) {
        handleLogout()
      }
      // Background heartbeat while user is active (< timeout)
      if (inactiveTime < effectiveTimeout) {
        void sendHeartbeat()
      }
    }, 30000)

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      clearInterval(checkInterval)
    }
  }, [inactivityTimeout])

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">⚠️ Sesión Inactiva</h3>
        <p className="text-gray-700 mb-4">
          Tu sesión se cerrará en 2 minutos. Mueve el mouse para continuar.
        </p>
        <button
          onClick={handleActivity}
          className="w-full bg-gradient-to-r from-blue-600 to-emerald-500 text-white py-2 px-4 rounded-lg hover:opacity-90"
        >
          Continuar Sesión
        </button>
      </div>
    </div>
  )
}
