import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rateLimit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Target paths for rate limiting (spam/DDoS protection)
  const isTargetRoute = 
    pathname === '/api/apply' || 
    (pathname === '/api/chat' && method === 'POST') ||
    (pathname === '/api/tasks/submit' && method === 'POST');

  if (isTargetRoute) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || (request as unknown as { ip: string }).ip || '127.0.0.1';
    
    // Strict Limits: Max 10 submissions/messages per minute
    const limit = 10;
    const durationSeconds = 60;

    const limitCheck = await checkRateLimit(ip, limit, durationSeconds);

    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limitCheck.limit),
            'X-RateLimit-Remaining': String(limitCheck.remaining),
            'X-RateLimit-Reset': String(limitCheck.reset),
            'Retry-After': String(limitCheck.reset - Math.floor(Date.now() / 1000)),
          }
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/apply', '/api/chat', '/api/tasks/submit'],
};
