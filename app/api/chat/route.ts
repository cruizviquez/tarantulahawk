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
  const startEmbed = Date.now();
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data as Float32Array);
  console.log(`[EMBED] ${Date.now() - startEmbed}ms`);
  return embedding;
}

const DEBUG_DEDUPE = process.env.DEBUG_DEDUPE === '1';
function debugLog(label: string, payload: any) {
  if (!DEBUG_DEDUPE) return;
  try {
    const s = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const out = s.length > 8000 ? s.slice(0, 8000) + '...[truncated]' : s;
    console.log(label, out);
  } catch {
    console.log(label, '[unserializable]');
  }
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

function dedupeReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Normalize whitespace to catch near-identical repeats
  const normalized = trimmed.replace(/\s+/g, ' ').trim();

  // If the whole text is the same block twice (with or without whitespace differences)
  // Use dot-all via [\s\S] to match across newlines
  const repeatMatch = normalized.match(/^([\s\S]+?)\s+\1$/);
  if (repeatMatch && repeatMatch[1]) {
    console.log('[DEDUPE] full-block repeat detected');
    return repeatMatch[1].trim();
  }

  // Try split-halves comparison (case-insensitive)
  if (normalized.length > 60) {
    const half = Math.floor(normalized.length / 2);
    const first = normalized.slice(0, half).trim().toLowerCase();
    const second = normalized.slice(half).trim().toLowerCase();
    if (first && first === second) {
      console.log('[DEDUPE] split-halves match');
      return normalized.slice(0, half).trim();
    }
  }

  // Drop duplicate paragraphs (case-insensitive)
  const seen = new Set<string>();
  // Split on one-or-more newlines to catch paragraph repeats
  const parts = trimmed.split(/\n+/);
  const filtered = parts.filter((p) => {
    const key = p.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const joined = filtered.join('\n').trim();
  const wasRepeated = parts.length > filtered.length;
  if (wasRepeated) {
    console.log('[DEDUPE] paragraph-level dedupe applied');
    // If dedupe did not reduce length (edge cases with whitespace), return first unique paragraph
    if (joined.length >= trimmed.length && filtered.length > 0) {
      return filtered[0].trim();
    }
  }
  // Sentence-level dedupe as final guard
  const sentenceSplit = (joined || trimmed)
    .split(/(?<=[\.\!\?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  const seenSent = new Set<string>();
  const uniqueSent = sentenceSplit.filter(s => {
    const key = s.replace(/\s+/g, ' ').toLowerCase();
    if (seenSent.has(key)) return false;
    seenSent.add(key);
    return true;
  });
  const sentenceJoined = uniqueSent.join(' ').trim();
  if (sentenceJoined.length < (joined || trimmed).length) {
    console.log('[DEDUPE] sentence-level dedupe applied');
    return sentenceJoined;
  }
  return joined || trimmed;
}

async function callGroq(systemPrompt: string, userPrompt: string) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  const startLLM = Date.now();
  debugLog('[GROQ_PROMPT]', { systemPrompt: systemPrompt.slice(0, 4000), userPrompt: userPrompt.slice(0, 4000) });
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
  debugLog('[GROQ_RAW]', data);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty response');
  const preview = String(content).slice(0, 160).replace(/\n/g, ' ');
  console.log(`[GROQ] ${Date.now() - startLLM}ms, len=${String(content).length}, preview="${preview}"`);
  return content.trim();
}

async function callHuggingFace(prompt: string) {
  const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
  if (!hfKey) throw new Error('HuggingFace API key not configured');

  const startLLM = Date.now();
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
  debugLog('[HF_RAW]', data);
  let textOut = '';
  if (typeof data === 'string') textOut = data;
  else if (Array.isArray(data) && data.length > 0 && typeof data[0].generated_text === 'string') textOut = data[0].generated_text;
  else if (Array.isArray(data) && data.length > 0 && typeof data[0].text === 'string') textOut = data[0].text;
  else textOut = JSON.stringify(data);
  console.log(`[HF] ${Date.now() - startLLM}ms`);
  return textOut.trim();
}

async function retrieveContext(sb: SupabaseClient, queryEmbedding: number[], k = 5) {
  const startRAG = Date.now();
  const { data, error } = await sb.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: k
  });

  if (error) throw error;
  if (!data || data.length === 0) return '';

  const context = data
    .map((row: any, idx: number) => `(${idx + 1}) ${row.title ?? 'doc'}: ${row.content}
URL: ${row.url ?? 'n/a'} (sim=${row.similarity?.toFixed?.(3) ?? 'n/a'})`)
    .join('\n');
  console.log(`[RAG] retrieved ${data.length} docs in ${Date.now() - startRAG}ms`);
  return context;
}

export async function POST(request: Request) {
  try {
    const body: ReqBody = await request.json();
    let { text, language = 'es', sessionId } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    // Truncate user input to prevent timeouts and cost overruns
    text = truncateText(text.trim(), 2000);

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
        // Truncate context to avoid token limit issues
        context = truncateText(context, 4000);
      } catch (err) {
        console.error('RAG retrieve failed', err);
      }
    }

    const dedupeInstruction = 'Responde una sola vez, sin repetir el mismo contenido ni el párrafo.';
    const systemPrompt = context
      ? `${system}\n\nContexto (usa solo si es relevante):\n${context}\n\n${dedupeInstruction}`
      : `${system}\n\n${dedupeInstruction}`;

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

    debugLog('[REPLY_RAW]', reply);
    const cleanedReply = dedupeReply(reply);
    if (cleanedReply !== reply) {
      console.log(`[DEDUPE] cleaned: orig_len=${reply.length}, new_len=${cleanedReply.length}`);
      debugLog('[REPLY_CLEANED]', cleanedReply);
    } else {
      console.log('[DEDUPE] no change');
    }

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
