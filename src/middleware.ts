import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/logout',
  '/intervista',
  '/assessment',
  '/premium',
  '/bp/review',
  '/bp/delivery',
  '/contatti',
  '/chi-siamo',
  '/metodo',
  '/casi-studio',
  '/api/auth/client-login',
  '/api/auth/logout',
  '/api/health',
  '/api/kb',
  '/api/booking',
  '/api/consultant/public-slots',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PATHS.some(p => pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (pathname.match(/\.(ico|png|jpg|svg|webp|css|js|json)$/)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;
  const sessionCookie = request.cookies.get('pi_session')?.value;

  if (!token && !sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)',
  ],
};
