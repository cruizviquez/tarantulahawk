import { NextRequest, NextResponse } from 'next/server';

// Minimal OCR endpoint using Google Vision REST if configured.
// Accepts multipart/form-data (file) or JSON { imageBase64?, imageUrl? }.
// Extracts Nombre, Apellido Paterno, Apellido Materno, RFC, CURP via regex/heuristics.

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let base64: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (file && file instanceof File) {
        const buf = Buffer.from(await file.arrayBuffer());
        base64 = buf.toString('base64');
      }
    } else {
      const body = await request.json().catch(() => ({} as any));
      if (body.imageBase64) {
        base64 = String(body.imageBase64);
      } else if (body.imageUrl) {
        const res = await fetch(String(body.imageUrl)).catch(() => null);
        if (res?.ok) {
          const ab = await res.arrayBuffer();
          base64 = Buffer.from(ab).toString('base64');
        }
      }
    }

    if (!base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const visionKey = process.env.VISION_API_KEY || process.env.GOOGLE_VISION_API_KEY;
    let rawText = '';

    if (visionKey) {
      const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}` , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      }).catch(() => null);

      if (visionRes?.ok) {
        const data = await visionRes.json().catch(() => null);
        const annotation = data?.responses?.[0]?.textAnnotations?.[0]?.description || '';
        rawText = String(annotation || '');
      }
    }

    if (!rawText) {
      // Fallback: no OCR configured or failed. Return basic response.
      return NextResponse.json({
        raw_text: '',
        note: 'OCR not configured (set VISION_API_KEY) or no text detected.',
        extracted: {
          nombre: null,
          apellido_paterno: null,
          apellido_materno: null,
          rfc: null,
          curp: null
        }
      });
    }

    // Normalize text for parsing
    const text = normalizeText(rawText);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extract RFC / CURP via regex
    const rfc = extractRFC(text);
    const curp = extractCURP(text);

    // Heuristic name extraction (INE patterns: APELLIDO PATERNO/MATERNO/NOMBRE)
    let apellido_paterno: string | null = null;
    let apellido_materno: string | null = null;
    let nombre: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!apellido_paterno && /apellido\s+paterno/i.test(l)) {
        apellido_paterno = pickNextToken(lines, i);
      }
      if (!apellido_materno && /apellido\s+materno/i.test(l)) {
        apellido_materno = pickNextToken(lines, i);
      }
      if (!nombre && /nombre(s)?/i.test(l)) {
        nombre = pickNextToken(lines, i);
      }
    }

    const extracted = {
      nombre: nombre || null,
      apellido_paterno: apellido_paterno || null,
      apellido_materno: apellido_materno || null,
      rfc: rfc || null,
      curp: curp || null
    };

    return NextResponse.json({ raw_text: rawText, extracted });
  } catch (err) {
    console.error('OCR endpoint error:', err);
    return NextResponse.json({ error: 'OCR processing failed', detail: String(err) }, { status: 500 });
  }
}

function normalizeText(str: string): string {
  return (str || '')
    .replace(/\r/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\t]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function extractRFC(text: string): string | null {
  // RFC (PF 13 / PM 12) rough pattern
  const regex = /\b[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}[0-9]\b/i;
  const m = text.match(regex);
  return m ? m[0].toUpperCase() : null;
}

function extractCURP(text: string): string | null {
  const regex = /\b[A-Z][AEIOU][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM][A-Z]{2}[BCDFGHJKLMNPQRSTVWXYZ]{3}[A-Z0-9]\d\b/i;
  const m = text.match(regex);
  return m ? m[0].toUpperCase() : null;
}

function pickNextToken(lines: string[], index: number): string | null {
  // Try same line after colon or next line if present
  const current = lines[index];
  const afterColon = current.split(':').slice(1).join(':').trim();
  if (afterColon) {
    return sanitizeName(afterColon);
  }
  const next = lines[index + 1] || '';
  return sanitizeName(next) || null;
}

function sanitizeName(s: string): string {
  // Keep letters and spaces; uppercase
  return s
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
