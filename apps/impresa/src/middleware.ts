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
  // Pagina pubblica di prenotazione call (/booking/[consultantId]) -
  // bug pre-esistente trovato il 25/08/2026: la pagina esisteva ma non
  // era mai stata aggiunta qui, quindi un visitatore anonimo veniva
  // rimandato al login prima ancora di vedere gli slot. Le sue API
  // (/api/booking, /api/consultant/public-slots) erano gia' pubbliche,
  // solo la pagina no.
  '/booking',
  '/api/auth/client-login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/kb',
  '/api/booking',
  '/api/consultant/public-slots',
  // Pilota Adaptive EOSv6 (28/08/2026): pagina interna di verifica del
  // circuito 6 Giudici su erpv6_core_engine, raggiungibile solo via tunnel
  // SSH verso la VPS (porta 3000 non esposta pubblicamente, solo 80/443 via
  // Caddy) -- bypassa il login dell'app invece di accendere il flag globale
  // NEXT_PUBLIC_USE_ODOO, che cambierebbe comportamento anche di
  // dashboard/booking/interview-tree/consultant per tutti. Da rimuovere o
  // proteggere sul serio prima di qualunque esposizione oltre il tunnel.
  '/admin/circuit',
  '/api/core-engine',
  // Proxy pubblici dell'intervista ad albero (/intervista/guidata, gia'
  // pagina pubblica) verso erpv6.interview.session lato Odoo - visitatori
  // anonimi, stesso schema di /api/leads POST qui sotto.
  '/api/interview-tree',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PATHS.some(p => pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // POST /api/leads è l'endpoint di invio lead da /intervista (pagina pubblica),
  // usato da visitatori anonimi: deve restare accessibile senza sessione.
  // GET/PUT restano protetti: espongono/agiscono sulla coda lead pendenti.
  if (pathname === '/api/leads' && request.method === 'POST') {
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
