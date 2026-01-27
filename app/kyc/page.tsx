import DocumentUpload from '@/app/components/kyc/DocumentUpload';

export default function KYCPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Módulo KYC</h1>
          <p className="text-gray-600 mb-8">
            Verificación de identidad y validación contra listas negras
          </p>

          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Flujo del Proceso</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                <span>Sube documento (INE/Pasaporte) usando drag & drop o botón</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                <span>OCR extrae datos automáticamente (Nombre, RFC, CURP)</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">3.</span>
                <span>Revisa y corrige datos si es necesario</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">4.</span>
                <span>Valida contra listas: OFAC, CSNU, Lista 69B, UIF, PEPs</span>
              </li>
            </ol>
          </div>

          <DocumentUpload />

          <div className="mt-8 p-4 bg-blue-50 rounded text-sm text-gray-700">
            <p className="font-semibold mb-1">💡 Nota:</p>
            <p>
              El OCR requiere <code className="bg-white px-1 rounded">VISION_API_KEY</code> configurada.
              Sin ella, deberás llenar el formulario manualmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
