import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotte pubbliche (NON richiedono autenticazione)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/logout',
  '/intervista',
  '/premium',          // ✅ Aggiunta!
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

  // 1. Rotte pubbliche → permesso
  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PATHS.some(p => pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 2. File statici → permesso
  if (pathname.match(/\.(ico|png|jpg|svg|webp|css|js|json)$/)) {
    return NextResponse.next();
  }

  // 3. Verifica token
  const token = request.cookies.get('token')?.value;
  const sessionCookie = request.cookies.get('pi_session')?.value;

  if (!token && !sessionCookie) {
    // API → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Pagine → redirect a login
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // 4. Token presente → lascia passare
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)',
  ],
};
