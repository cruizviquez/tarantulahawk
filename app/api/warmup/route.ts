import { NextResponse } from 'next/server';

// Lazy-load transformers to trigger model download and warmup
let warmupPromise: Promise<void> | null = null;

async function warmupEmbeddings() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      // Run a dummy embedding to cache the model
      await extractor('warmup', { pooling: 'mean', normalize: true });
      console.log('[WARMUP] Embedding model loaded and cached');
    })();
  }
  return warmupPromise;
}

export async function GET() {
  try {
    const start = Date.now();
    await warmupEmbeddings();
    const elapsed = Date.now() - start;
    return NextResponse.json({ 
      status: 'ready', 
      warmupTime: `${elapsed}ms`,
      message: 'Embedding model warmed up successfully'
    });
  } catch (err) {
    console.error('Warmup failed', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
