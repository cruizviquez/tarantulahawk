'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'

interface SessionMonitorProps {
  userId: string
  inactivityTimeout?: number
}

export default function SessionMonitor({ 
  userId, 
  inactivityTimeout = 15 * 60 * 1000 
}: SessionMonitorProps) {
  const lastActivityRef = useRef<number>(Date.now())
  const warningShownRef = useRef<boolean>(false)
  const [showWarning, setShowWarning] = useState(false)

  const WARNING_TIME = 2 * 60 * 1000

  const handleActivity = () => {
    lastActivityRef.current = Date.now()
    warningShownRef.current = false
    setShowWarning(false)
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.clear()
      sessionStorage.clear()
      window.location.replace('/')
    } catch (error) {
      window.location.replace('/')
    }
  }

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    const checkInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityRef.current

      if (inactiveTime >= inactivityTimeout - WARNING_TIME && !warningShownRef.current) {
        setShowWarning(true)
        warningShownRef.current = true
      }

      if (inactiveTime >= inactivityTimeout) {
        handleLogout()
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
