# 🔧 Solución: Error "Bucket not found" en Documentos

## 📋 Problema Identificado

Al intentar visualizar documentos en la pestaña "Documentos" del módulo KYC, aparece el siguiente error:

```json
{
  "statusCode": "404",
  "error": "Bucket not found",
  "message": "Bucket not found"
}
```

**Causa**: El bucket de Supabase Storage llamado `kyc-documentos` no existe en tu instancia de Supabase.

---

## ✅ Solución Rápida

### Opción 1: Crear el bucket desde Supabase Dashboard (Recomendada)

1. **Accede a Supabase Dashboard**
   - Ve a: https://app.supabase.com
   - Selecciona tu proyecto TarantulaHawk

2. **Navega a Storage**
   - Click en **Storage** en el menú lateral
   - Click en **"New bucket"** (botón verde)

3. **Configura el bucket**
   - **Name**: `kyc-documentos`
   - **Public bucket**: ✅ **Activado** (importante para visualización)
   - **File size limit**: `10 MB` (10485760 bytes)
   - **Allowed MIME types**: 
     ```
     image/jpeg
     image/png
     image/jpg
     application/pdf
     ```
   - Click en **"Create bucket"**

4. **Configurar políticas de acceso** (IMPORTANTE)
   - Click en el bucket recién creado
   - Ve a la pestaña **"Policies"**
   - Click en **"New Policy"**
   - Selecciona **"Allow public access to files"** o crea políticas personalizadas

### Opción 2: Ejecutar el script SQL

1. **Accede a SQL Editor en Supabase**
   - Dashboard > SQL Editor > New Query

2. **Copia y pega el contenido completo de**:
   ```bash
   CREAR_BUCKET_DOCUMENTOS.sql
   ```

3. **Ejecuta el script**
   - Click en "Run" o presiona `Ctrl+Enter`

4. **Verifica la creación**
   - Ejecuta esta query:
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'kyc-documentos';
   ```
   - Deberías ver el bucket en los resultados

---

## 🧪 Verificación

### 1. Verifica que el bucket existe
En SQL Editor:
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'kyc-documentos';
```

**Resultado esperado**:
```
id              | name            | public | file_size_limit
kyc-documentos  | kyc-documentos  | true   | 10485760
```

### 2. Verifica las políticas RLS
```sql
SELECT * FROM storage.policies WHERE bucket_id = 'kyc-documentos';
```

### 3. Prueba en la aplicación
1. Recarga la página del portal
2. Ve a **Clientes & KYC**
3. Selecciona un cliente
4. Click en la pestaña **"Documentos"**
5. Click en el botón **"Agregar Documento"**
6. Sube una imagen o PDF
7. Verifica que se muestre correctamente y puedas visualizarla

---

## 🔐 Configuración de Seguridad (RLS Policies)

Si creaste el bucket manualmente, asegúrate de configurar estas políticas en Storage > Policies:

### Política de INSERT (Subir archivos)
```sql
CREATE POLICY "auth_users_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documentos');
```

### Política de SELECT (Ver archivos)
```sql
CREATE POLICY "public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'kyc-documentos');
```

### Política de DELETE (Eliminar archivos)
```sql
CREATE POLICY "auth_users_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'kyc-documentos');
```

---

## ⚠️ Troubleshooting

### Error persiste después de crear el bucket

1. **Limpia la caché del navegador**
   ```
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

2. **Verifica las variables de entorno**
   - Archivo: `.env.local`
   - Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` sean correctas

3. **Reinicia el servidor de desarrollo**
   ```bash
   npm run dev
   ```

4. **Verifica los logs de Supabase**
   - Dashboard > Logs > Storage
   - Busca errores relacionados con el bucket

### El archivo se sube pero no se visualiza

1. **Verifica que el bucket sea público**
   ```sql
   UPDATE storage.buckets 
   SET public = true 
   WHERE id = 'kyc-documentos';
   ```

2. **Verifica la política de lectura pública**
   - Debe existir una política que permita `SELECT` a `public`

---

## 📚 Archivos Relacionados

- **Script SQL**: `CREAR_BUCKET_DOCUMENTOS.sql`
- **API Route**: `app/api/clientes/[id]/documentos/route.ts`
- **Componente Frontend**: `app/components/kyc/KYCModule.tsx`

---

## 🎯 Resumen de Acción Inmediata

```bash
# 1. Ve a Supabase Dashboard
https://app.supabase.com

# 2. Storage > New Bucket
Nombre: kyc-documentos
Public: ✅ Activado

# 3. Configura políticas públicas de lectura

# 4. Recarga tu aplicación
```

**¡Listo!** Ahora deberías poder subir y visualizar documentos sin errores.
