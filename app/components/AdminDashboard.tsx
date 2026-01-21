'use client';

import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Activity, Key, Settings, TrendingUp, Search, Filter, Download } from 'lucide-react';
import { formatDateShortES } from '../lib/dateFormatter';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  company: string;
  subscription_tier: string;
  role?: 'client' | 'auditor' | 'admin';
  account_balance_usd: number;
  custom_rate_per_txn?: number;
  total_transactions: number;
  total_spent: number;
  last_activity: string;
  created_at: string;
  api_key?: string;
  api_requests_count?: number;
}

interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount_usd: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'transactions' | 'api-keys'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Mock data - replace with real API calls
  useEffect(() => {
    // Fetch users from Supabase
    // const { data } = await supabase.from('profiles').select('*')
    setUsers([
      {
        id: '1',
        email: 'empresa@ejemplo.com',
        name: 'Juan Pérez',
        company: 'Empresa Demo',
        subscription_tier: 'enterprise',
        account_balance_usd: 5234.50,
        custom_rate_per_txn: 0.25,
        total_transactions: 45230,
        total_spent: 12450.00,
        last_activity: '2025-10-26T10:30:00Z',
        created_at: '2025-01-15T08:00:00Z',
        api_key: 'thk_abc123...',
        api_requests_count: 1250
      }
    ]);
  }, []);

  const stats = {
    totalUsers: users.length,
    totalRevenue: users.reduce((sum, u) => sum + u.total_spent, 0),
    totalTransactions: users.reduce((sum, u) => sum + u.total_transactions, 0),
    activeApiKeys: users.filter(u => u.api_key).length
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || user.subscription_tier === filterTier;
    return matchesSearch && matchesTier;
  });

  const updateUserTier = async (userId: string, newTier: string) => {
    // Update in Supabase
    // await supabase.from('profiles').update({ subscription_tier: newTier }).eq('id', userId)
    alert(`Usuario actualizado a tier: ${newTier}`);
  };

  const updateCustomRate = async (userId: string, newRate: number) => {
    // Update in Supabase
    // await supabase.from('profiles').update({ custom_rate_per_txn: newRate }).eq('id', userId)
    alert(`Tarifa personalizada actualizada: $${newRate}/txn`);
  };

  const addCredits = async (userId: string, amount: number) => {
    // Call API to add credits
    // await fetch('/api/credits/add', { ... })
    alert(`Agregados $${amount} USD en créditos`);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
          TarantulaHawk Admin
        </h1>
        <p className="text-gray-400">Panel de administración de clientes y transacciones</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-teal-400" />
            <span className="text-3xl font-bold">{stats.totalUsers}</span>
          </div>
          <p className="text-gray-400 text-sm">Total Clientes</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-400" />
            <span className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</span>
          </div>
          <p className="text-gray-400 text-sm">Ingresos Totales</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-emerald-400" />
            <span className="text-3xl font-bold">{stats.totalTransactions.toLocaleString()}</span>
          </div>
          <p className="text-gray-400 text-sm">Transacciones Procesadas</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Key className="w-8 h-8 text-purple-400" />
            <span className="text-3xl font-bold">{stats.activeApiKeys}</span>
          </div>
          <p className="text-gray-400 text-sm">API Keys Activas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {(['overview', 'users', 'transactions', 'api-keys'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === tab
                ? 'text-emerald-500 border-b-2 border-emerald-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'overview' && 'Resumen'}
            {tab === 'users' && 'Usuarios'}
            {tab === 'transactions' && 'Transacciones'}
            {tab === 'api-keys' && 'API Keys'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {/* Search and Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por email, nombre o empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos los tiers</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <button className="px-6 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 transition flex items-center gap-2">
              <Download className="w-5 h-5" />
              Exportar
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="text-left p-4 text-gray-400 font-semibold">Cliente</th>
                  <th className="text-left p-4 text-gray-400 font-semibold">Tier</th>
                  <th className="text-right p-4 text-gray-400 font-semibold">Balance</th>
                  <th className="text-right p-4 text-gray-400 font-semibold">Transacciones</th>
                  <th className="text-right p-4 text-gray-400 font-semibold">Gastado</th>
                  <th className="text-center p-4 text-gray-400 font-semibold">Tarifa Custom</th>
                  <th className="text-center p-4 text-gray-400 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-t border-gray-800 hover:bg-gray-900/30 transition">
                    <td className="p-4">
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                        <div className="text-xs text-gray-500">{user.company}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <select
                          value={user.role || 'client'}
                          onChange={(e) => updateUserTier(user.id, e.target.value)}
                          className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                          <option value="client">Cliente</option>
                          <option value="auditor">Auditor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <span className="text-xs text-gray-500">tier: {user.subscription_tier || 'n/a'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-green-400">
                        ${user.account_balance_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <button
                        onClick={() => {
                          const amount = prompt('Agregar créditos (USD):');
                          if (amount) addCredits(user.id, parseFloat(amount));
                        }}
                        className="text-xs text-teal-400 hover:underline"
                      >
                        + Agregar
                      </button>
                    </td>
                    <td className="p-4 text-right font-mono">
                      {user.total_transactions.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-bold">
                      ${user.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      {user.subscription_tier === 'enterprise' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={user.custom_rate_per_txn || ''}
                          onChange={(e) => updateCustomRate(user.id, parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-center"
                          placeholder="0.00"
                        />
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Ingresos por Mes
            </h3>
            <div className="text-gray-400">Gráfico de ingresos mensuales (implementar con Recharts/Chart.js)</div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">Distribución por Tier</h3>
            <div className="space-y-3">
              {['free', 'basic', 'premium', 'enterprise'].map(tier => {
                const count = users.filter(u => u.subscription_tier === tier).length;
                const percentage = (count / users.length) * 100 || 0;
                return (
                  <div key={tier}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{tier}</span>
                      <span>{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">{selectedUser.name}</h2>
                <p className="text-gray-400">{selectedUser.email}</p>
                <p className="text-sm text-gray-500">{selectedUser.company}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Balance Actual</div>
                <div className="text-2xl font-bold text-green-400">
                  ${selectedUser.account_balance_usd.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Total Gastado</div>
                <div className="text-2xl font-bold">${selectedUser.total_spent.toFixed(2)}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Transacciones</div>
                <div className="text-2xl font-bold">{selectedUser.total_transactions.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Tier</div>
                <div className="text-2xl font-bold capitalize">{selectedUser.subscription_tier}</div>
              </div>
            </div>

            {selectedUser.api_key && (
              <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-400 mb-2">API Key</div>
                <div className="font-mono text-sm bg-black/50 p-3 rounded border border-gray-800">
                  {selectedUser.api_key}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {selectedUser.api_requests_count} requests realizadas
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              Creado: {formatDateShortES(selectedUser.created_at)} • 
              Última actividad: {formatDateShortES(selectedUser.last_activity)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
