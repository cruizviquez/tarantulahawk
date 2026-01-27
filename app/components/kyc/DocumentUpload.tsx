'use client';

import React, { useCallback, useState } from 'react';

export default function DocumentUpload() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [form, setForm] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    rfc: '',
    curp: ''
  });
  const [loading, setLoading] = useState(false);
  const [validacion, setValidacion] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [savedClienteId, setSavedClienteId] = useState<string | null>(null);
  const [savedSignedUrl, setSavedSignedUrl] = useState<string | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const onBrowse = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const runOCR = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setOcrResult(null);
      if (!file) {
        setError('Selecciona un archivo primero');
        setLoading(false);
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/kyc/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      setOcrResult(data);
      const ex = data?.extracted || {};
      setForm({
        nombre: ex.nombre || '',
        apellido_paterno: ex.apellido_paterno || '',
        apellido_materno: ex.apellido_materno || '',
        rfc: ex.rfc || '',
        curp: ex.curp || ''
      });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [file]);

  const validarListas = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setValidacion(null);
      const res = await fetch('/api/kyc/validar-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido_paterno: form.apellido_paterno,
          apellido_materno: form.apellido_materno,
          rfc: form.rfc
        })
      });
      const data = await res.json();
      setValidacion(data);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [form]);

  const guardarExpediente = useCallback(async () => {
    try {
      if (!validacion || !file) {
        setError('Debes ejecutar OCR y Validar Listas primero');
        return;
      }
      setError(null);
      setGuardando(true);
      const fd = new FormData();
      fd.append('documento', file);
      fd.append('clienteData', JSON.stringify(form));
      fd.append('validaciones', JSON.stringify(validacion.validaciones));
      fd.append('clasificacionEBR', JSON.stringify({
        nivel: validacion.nivel_riesgo,
        score: validacion.score_riesgo,
        decision: validacion.decision,
        estado: validacion.estado
      }));
      const res = await fetch('/api/kyc/expediente', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        alert('✅ Expediente guardado exitosamente (conservación 10 años)');
        setSavedClienteId(data?.cliente?.id || null);
        setSavedSignedUrl(data?.documento_signed_url || null);
      } else {
        setError(data.error || 'Error guardando expediente');
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setGuardando(false);
    }
  }, [form, validacion, file]);

  const verDocumento = useCallback(async () => {
    try {
      setError(null);
      // Si ya tenemos una URL firmada reciente, abrirla directamente
      if (savedSignedUrl) {
        window.open(savedSignedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!savedClienteId) {
        setError('Primero guarda el expediente para obtener el documento');
        return;
      }
      const res = await fetch(`/api/kyc/documento/${savedClienteId}?expires=600`, { method: 'GET' });
      const data = await res.json();
      if (data?.signed_url) {
        window.open(String(data.signed_url), '_blank', 'noopener,noreferrer');
      } else {
        setError(data?.error || 'No se pudo generar la URL firmada');
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    }
  }, [savedClienteId, savedSignedUrl]);

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`border-2 border-dashed rounded p-6 text-center ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
      >
        <p className="mb-2">Arrastra y suelta INE/Pasaporte aquí</p>
        <p className="text-sm text-gray-500">o</p>
        <label className="inline-block mt-2">
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={onBrowse} />
          <span className="px-3 py-2 bg-gray-100 rounded cursor-pointer">Seleccionar archivo</span>
        </label>
        {file && <p className="mt-2 text-sm">Archivo: {file.name}</p>}
      </div>

      <div className="flex gap-2">
        <button onClick={runOCR} disabled={loading || !file} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">OCR</button>
        <button onClick={validarListas} disabled={loading} className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50">Validar Listas</button>
        <button onClick={guardarExpediente} disabled={guardando || !validacion} className="px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50">Guardar Expediente</button>
        <button onClick={verDocumento} disabled={!savedClienteId && !savedSignedUrl} className="px-3 py-2 bg-gray-800 text-white rounded disabled:opacity-50">Ver Documento</button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Nombre</label>
          <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">Apellido Paterno</label>
          <input value={form.apellido_paterno} onChange={e => setForm({ ...form, apellido_paterno: e.target.value })} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">Apellido Materno</label>
          <input value={form.apellido_materno} onChange={e => setForm({ ...form, apellido_materno: e.target.value })} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">RFC</label>
          <input value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value })} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">CURP</label>
          <input value={form.curp} onChange={e => setForm({ ...form, curp: e.target.value })} className="w-full border rounded p-2" />
        </div>
      </div>

      {ocrResult && (
        <div className="mt-4">
          <h3 className="font-semibold">OCR</h3>
          <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(ocrResult, null, 2)}</pre>
        </div>
      )}

      {validacion && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Validación Listas</h3>
          
          {/* PASO 5 & 6: Clasificación EBR + Decisión */}
          <div className={`p-4 rounded mb-3 ${
            validacion.decision === 'APROBADO' ? 'bg-green-100 border-2 border-green-500' :
            validacion.decision === 'RECHAZADO' ? 'bg-red-100 border-2 border-red-500' :
            'bg-yellow-100 border-2 border-yellow-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">
                  {validacion.decision === 'APROBADO' && '✅ APROBADO AUTOMÁTICO'}
                  {validacion.decision === 'RECHAZADO' && '❌ RECHAZADO AUTOMÁTICO'}
                  {validacion.decision === 'REVISION_MANUAL' && '⚠️ REVISIÓN MANUAL REQUERIDA'}
                </p>
                <p className="text-sm mt-1">
                  Clasificación EBR: <strong>{validacion.nivel_riesgo}</strong> | Score: <strong>{validacion.score_riesgo}/100</strong>
                </p>
              </div>
            </div>
          </div>

          <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(validacion, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
