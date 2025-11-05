'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Activity, Users, Clock } from 'lucide-react';

interface SuspiciousActivity {
  user_id: string;
  email: string;
  total_actions_24h: number;
  unique_ips_24h: number;
  warnings_24h: number;
  last_activity: string;
  risk_score: number;
}

interface ActivityStats {
  total_users_active: number;
  total_alerts_today: number;
  high_risk_users: number;
  avg_actions_per_user: number;
}

export default function SecurityDashboard() {
  const [suspiciousUsers, setSuspiciousUsers] = useState<SuspiciousActivity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadSecurityData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      const response = await fetch('/api/admin/security', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load security data');
      
      const data = await response.json();
      setSuspiciousUsers(data.suspicious_users || []);
      setStats(data.stats || null);
      setLoading(false);
    } catch (error) {
      console.error('Security data load error:', error);
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 71) return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    if (score >= 51) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 21) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-green-500 bg-green-500/10 border-green-500/30';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 71) return '🔥 CRÍTICO';
    if (score >= 51) return '🚨 ALTO';
    if (score >= 21) return '⚠️ SOSPECHOSO';
    return '✅ NORMAL';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Cargando datos de seguridad...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Shield className="w-10 h-10 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold">🤖 AI Security Dashboard</h1>
            <p className="text-gray-400">Monitoreo de anomalías en tiempo real</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-teal-400" />
                <span className="text-gray-400 text-sm">Usuarios Activos</span>
              </div>
              <div className="text-3xl font-bold">{stats.total_users_active}</div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="text-gray-400 text-sm">Alertas Hoy</span>
              </div>
              <div className="text-3xl font-bold text-yellow-400">{stats.total_alerts_today}</div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400 text-sm">Alto Riesgo</span>
              </div>
              <div className="text-3xl font-bold text-blue-400">{stats.high_risk_users}</div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400 text-sm">Avg. Acciones/Usuario</span>
              </div>
              <div className="text-3xl font-bold">{stats.avg_actions_per_user.toFixed(1)}</div>
            </div>
          </div>
        )}

        {/* Suspicious Users Table */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-blue-500" />
            Actividad Sospechosa (Últimas 24h)
          </h2>

          {suspiciousUsers.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">✅ No se detectó actividad sospechosa</p>
              <p className="text-gray-500 text-sm mt-2">El sistema AI está monitoreando constantemente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Usuario</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Risk Score</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Acciones</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">IPs Únicas</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Alertas</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Última Actividad</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suspiciousUsers.map((user) => (
                    <tr key={user.user_id} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="py-4 px-4">
                        <div className="font-mono text-sm text-gray-300">{user.email}</div>
                        <div className="text-xs text-gray-500 mt-1">{user.user_id.slice(0, 8)}...</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getRiskColor(user.risk_score)}`}>
                          {user.risk_score}
                        </span>
                        <div className="text-xs mt-1">{getRiskLabel(user.risk_score)}</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                          <span className={user.total_actions_24h > 100 ? 'text-blue-400 font-bold' : 'text-white'}>
                          {user.total_actions_24h}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={user.unique_ips_24h > 3 ? 'text-emerald-400 font-bold' : 'text-white'}>
                          {user.unique_ips_24h}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={user.warnings_24h > 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
                          {user.warnings_24h}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-500" />
                          {new Date(user.last_activity).toLocaleString('es-MX')}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button 
                          onClick={() => window.open(`/admin/users/${user.user_id}`, '_blank')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition"
                        >
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Rules Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-900/20 to-black border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 text-blue-400">🔥 Reglas Críticas</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• <strong>&gt;100 acciones</strong> en 24h → +30 risk score</li>
              <li>• <strong>&gt;3 IPs diferentes</strong> en 15 min → +30 risk score</li>
              <li>• <strong>Acciones &lt;500ms</strong> de diferencia → +20 risk score</li>
              <li>• <strong>2 AM - 5 AM</strong> con alta actividad → +10 risk score</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-900/20 to-black border border-green-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 text-green-400">✅ Acciones Automáticas</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• <strong>Risk 0-20:</strong> Normal, sin acción</li>
              <li>• <strong>Risk 21-50:</strong> Monitoreo activo</li>
              <li>• <strong>Risk 51-70:</strong> Alerta a admins</li>
              <li>• <strong>Risk 71-100:</strong> Auto-suspensión temporal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
