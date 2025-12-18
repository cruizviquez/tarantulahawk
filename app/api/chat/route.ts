import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type ReqBody = {
  text: string;
  language?: string;
  sessionId?: string;
};

// Lazy-load transformers to compute embeddings locally (no external API for embeddings).
let embeddingPipelinePromise: Promise<any> | null = null;
async function getEmbeddingPipeline() {
  if (!embeddingPipelinePromise) {
    embeddingPipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      // Use a small, widely available embedding model
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    })();
  }
  return embeddingPipelinePromise;
}

async function embedText(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

function dedupeReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Normalize whitespace to catch near-identical repeats
  const normalized = trimmed.replace(/\s+/g, ' ').trim();

  // If the whole text is the same block twice (with or without whitespace differences)
  const repeatMatch = normalized.match(/^(.+?)\s+\1$/);
  if (repeatMatch && repeatMatch[1]) return repeatMatch[1].trim();

  // Try split-halves comparison (case-insensitive)
  if (normalized.length > 60) {
    const half = Math.floor(normalized.length / 2);
    const first = normalized.slice(0, half).trim().toLowerCase();
    const second = normalized.slice(half).trim().toLowerCase();
    if (first && first === second) return normalized.slice(0, half).trim();
  }

  // Drop duplicate paragraphs (case-insensitive)
  const seen = new Set<string>();
  const parts = trimmed.split(/\n{2,}/);
  const filtered = parts.filter((p) => {
    const key = p.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const joined = filtered.join('\n\n').trim();
  return joined || trimmed;
}

async function callGroq(systemPrompt: string, userPrompt: string) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 512,
      stream: false
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Groq inference error: ' + txt);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty response');
  return content.trim();
}

async function callHuggingFace(prompt: string) {
  const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
  if (!hfKey) throw new Error('HuggingFace API key not configured');

  // Use free inference API with a smaller model (has rate limits and cold starts)
  const res = await fetch('https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      inputs: prompt, 
      parameters: { 
        max_new_tokens: 512, 
        temperature: 0.7,
        return_full_text: false
      },
      options: {
        wait_for_model: true
      }
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('HF inference error: ' + txt);
  }

  const data = await res.json();
  let textOut = '';
  if (typeof data === 'string') textOut = data;
  else if (Array.isArray(data) && data.length > 0 && typeof data[0].generated_text === 'string') textOut = data[0].generated_text;
  else if (Array.isArray(data) && data.length > 0 && typeof data[0].text === 'string') textOut = data[0].text;
  else textOut = JSON.stringify(data);
  return textOut.trim();
}

async function retrieveContext(sb: SupabaseClient, queryEmbedding: number[], k = 5) {
  const { data, error } = await sb.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: k
  });

  if (error) throw error;
  if (!data || data.length === 0) return '';

  return data
    .map((row: any, idx: number) => `(${idx + 1}) ${row.title ?? 'doc'}: ${row.content}
URL: ${row.url ?? 'n/a'} (sim=${row.similarity?.toFixed?.(3) ?? 'n/a'})`)
    .join('\n');
}

export async function POST(request: Request) {
  try {
    const body: ReqBody = await request.json();
    const { text, language = 'es', sessionId } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    const system = language === 'en'
      ? 'You are a helpful assistant for TarantulaHawk. Answer concisely and politely.'
      : 'Eres un asistente útil para TarantulaHawk. Responde de manera breve y cortés.';

    let context = '';
    let supabaseClient: SupabaseClient | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
      try {
        const queryEmbedding = await embedText(text);
        context = await retrieveContext(supabaseClient, queryEmbedding, 5);
      } catch (err) {
        console.error('RAG retrieve failed', err);
      }
    }

    const systemPrompt = context
      ? `${system}\n\nContexto (usa solo si es relevante):\n${context}`
      : system;

    const userPrompt = context
      ? `Pregunta: ${text}`
      : text;

    // Prefer Groq if configured; otherwise fall back to HF free tier.
    let reply: string;
    if (process.env.GROQ_API_KEY) {
      reply = await callGroq(systemPrompt, userPrompt);
    } else {
      const hfPrompt = `${systemPrompt}\n\n${userPrompt}\n\nInstrucciones: responde una sola vez, sin repetir el mismo texto.`;
      reply = await callHuggingFace(hfPrompt);
    }

    const cleanedReply = dedupeReply(reply);

    // Persist conversation to Supabase if configured
    if (supabaseClient) {
      try {
        await supabaseClient.from('conversations').insert([{ session_id: sessionId || null, user_text: text, bot_text: cleanedReply, language }]);
      } catch (e) {
        console.error('Supabase insert failed', e);
      }
    }

    // Stream the reply in small chunks to simulate token streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 40;
        for (let i = 0; i < cleanedReply.length; i += chunkSize) {
          const chunk = cleanedReply.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          // small pause to improve perceived streaming UX
          await new Promise((r) => setTimeout(r, 30));
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    console.error('Chat route error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
