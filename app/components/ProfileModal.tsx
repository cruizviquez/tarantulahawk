'use client';

import React, { useState, useEffect } from 'react';
import { User, Building2, Phone, Briefcase, Mail, DollarSign, X, Save, Upload } from 'lucide-react';

interface ProfileModalProps {
  user: {
    id: string;
    email: string;
    name: string;
    company: string;
    balance: number;
    phone?: string;
    position?: string;
    avatar_url?: string;
  };
  onClose: () => void;
  onUpdate: (updatedData: any) => void;
}

export default function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    company: user.company || '',
    phone: user.phone || '',
    position: user.position || '',
    avatar_url: user.avatar_url || '',
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      const result = await response.json();
      onUpdate(formData);
      
      // Show success message
      alert('✅ Perfil actualizado correctamente');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('❌ Error al actualizar perfil. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Mi Cuenta</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-4 font-semibold transition ${
              activeTab === 'profile'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-400/5'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <User className="w-5 h-5 inline mr-2" />
            Perfil
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 px-6 py-4 font-semibold transition ${
              activeTab === 'account'
                ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-400/5'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <DollarSign className="w-5 h-5 inline mr-2" />
            Cuenta
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  {formData.avatar_url ? (
                    <img
                      src={formData.avatar_url}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover border-2 border-teal-400"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white border-2 border-teal-400">
                      {formData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    URL de Avatar (opcional)
                  </label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://ejemplo.com/avatar.jpg"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pega la URL de una imagen para tu avatar
                  </p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-400"
                  placeholder="Juan Pérez"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Empresa
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-400"
                  placeholder="Mi Empresa S.A."
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  Cargo / Posición
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-400"
                  placeholder="Director de Cumplimiento"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-400"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El email no puede ser modificado
                </p>
              </div>

              {/* Balance (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Saldo Disponible
                </label>
                <div className="px-4 py-3 bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">
                    ${user.balance.toFixed(2)} USD
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Créditos disponibles para análisis
                  </p>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-white mb-3">Información de Cuenta</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">ID de Usuario:</span>
                    <span className="text-gray-300 font-mono text-xs">{user.id.substring(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tipo de Cuenta:</span>
                    <span className="text-teal-400 font-semibold">Pay-as-you-go</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estado:</span>
                    <span className="text-green-400 font-semibold">✓ Activa</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition font-semibold"
          >
            Cancelar
          </button>
          {activeTab === 'profile' && (
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-blue-600 rounded-lg text-white font-semibold hover:from-teal-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
