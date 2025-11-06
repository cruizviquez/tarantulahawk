import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Lightweight heartbeat: updates an HttpOnly last-activity cookie
export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 })
  const now = Date.now().toString()
  res.cookies.set('th-last-activity', now, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 60, // 1h cap on cookie lifetime
  })
  return res
}

// Optional GET for debugging/keepalive
export async function GET(request: NextRequest) {
  return await POST(request)
}
