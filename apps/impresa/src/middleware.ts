import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// 10/09/2026 (Denis: "mi fai accedere alla dashboard senza mettere
// nemmeno un login... non mi sembra corretto"): il controllo qui sotto
// verificava SOLO che un cookie chiamato pi_session esistesse, mai il suo
// contenuto - chiunque poteva scrivere document.cookie="pi_session=x" da
// devtools ed entrare in /admin/dashboard, /consultant/dashboard, ecc.
// senza nessuna credenziale reale (verificato dal vivo con un cookie
// finto). Il login vero genera gia' un JWT firmato da Odoo
// (erpv6_api_gateway._generate_jwt, ora con 'role' incluso nel payload
// firmato) - qui lo verifichiamo davvero (firma + scadenza) invece di
// fidarci del JSON leggibile nel cookie, e usiamo il ruolo DAL TOKEN
// (non dal JSON del cookie, che chiunque puo' riscrivere) per decidere
// se /admin/* e /consultant/* sono permessi.
const JWT_SECRET = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;

async function getVerifiedSession(request: NextRequest): Promise<{ userId: number; role: string } | null> {
  if (!JWT_SECRET) return null;

  let rawToken = request.cookies.get('token')?.value;
  if (!rawToken) {
    const sessionCookie = request.cookies.get('pi_session')?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie));
        rawToken = parsed?.token;
      } catch {
        return null;
      }
    }
  }
  if (!rawToken) return null;

  try {
    const { payload } = await jwtVerify(rawToken, JWT_SECRET);
    if (!payload.role || typeof payload.user_id !== 'number') return null;
    return { userId: payload.user_id as number, role: payload.role as string };
  } catch {
    return null;
  }
}

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
  '/project-finance',
  // business-plan-pmi/business-plan-startup RITIRATE (09/09/2026) - ora
  // redirect HTTP reali in next.config.js, non piu' pagine qui, rimosse
  // da questa lista.
  //
  // 09/09/2026 (analisi SEO, prompt "Candidatura partnership + routing
  // token prodotto + rotazione claim homepage" + seguito): bug PREESISTENTE
  // trovato qui, stesso pattern di /booking segnalato il 25/08/2026 -
  // queste landing pubbliche esistevano ma non erano in PUBLIC_PATHS,
  // quindi un visitatore anonimo (o Googlebot) veniva rimandato a /login
  // prima di vedere il contenuto. project-finance sopra ha lo stesso bug,
  // aggiunta insieme a questo fix. Le nuove landing di prodotto (Parte D)
  // vanno qui fin da subito.
  '/business-plan',
  '/analisi-aziendale',
  '/ricambio-generazionale',
  '/acquisto-tee',
  '/esg',
  '/team-building',
  '/formazione-aziendale',
  '/kaizen-lean',
  '/partnership',
  '/blog',
  // Convenzione Next.js App Router: src/app/robots.ts e src/app/sitemap.ts
  // compilano rispettivamente a /robots.txt e /sitemap.xml - senza
  // l'estensione .txt/.xml nel controllo statico piu' sotto, entrambi
  // venivano rimandati a /login (verificato dal vivo: curl su
  // www.v6impresa.it/robots.txt tornava 307 -> /login). Un robots.txt
  // irraggiungibile e' un problema SEO serio quanto le pagine bloccate.
  '/robots.txt',
  '/sitemap.xml',
  // llms.txt (09/09/2026, richiesto esplicitamente "leggibile dalle IA") -
  // stesso identico bug di robots.txt/sitemap.xml sopra se non fosse qui.
  '/llms.txt',
  // Pagina pubblica di prenotazione call (/booking/[consultantId]) -
  // bug pre-esistente trovato il 25/08/2026: la pagina esisteva ma non
  // era mai stata aggiunta qui, quindi un visitatore anonimo veniva
  // rimandato al login prima ancora di vedere gli slot. Le sue API
  // (/api/booking, /api/consultant/public-slots) erano gia' pubbliche,
  // solo la pagina no.
  '/booking',
  // 10/09/2026: pagina pubblica di conferma orario call - il cliente
  // arriva qui da un link email, mai loggato. Il token stesso e' il
  // segreto (stesso principio di /report/[token]).
  '/api/booking-confirm',
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
  // Report Win-Win asincrono (prompt web-async, 06/09/2026): la pagina
  // /report/[token] e le sue due API di supporto sono raggiunte da un
  // cliente anonimo via link email o redirect diretto a fine intervista -
  // il token stesso e' l'unico segreto (non enumerabile), niente cookie di
  // sessione da aspettarsi qui, stesso principio di /intervista/guidata.
  '/api/winwin-report',
  '/report',
  // 23/09/2026: pitch pubblico progetto (/p/<alias>) + candidacy.
  // Riusa erpv6.partnership.candidacy. Visibile ad aziende esterne,
  // il link stesso è il segreto (slug non enumerabile).
  '/p',
  '/api/public',
];

export async function middleware(request: NextRequest) {
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

  // POST /api/partnership è l'endpoint di invio candidatura da /partnership
  // (pagina pubblica, Parte A), stesso schema di /api/leads sopra.
  if (pathname === '/api/partnership' && request.method === 'POST') {
    return NextResponse.next();
  }

  if (pathname.match(/\.(ico|png|jpg|svg|webp|css|js|json)$/)) {
    return NextResponse.next();
  }

  const unauthorized = () => {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  };

  const session = await getVerifiedSession(request);
  if (!session) {
    return unauthorized();
  }

  // Il ruolo qui viene dal JWT verificato sopra, mai dal JSON del cookie:
  // un utente autenticato ma con ruolo 'client'/'consultant' non deve
  // poter entrare in /admin/* solo perche' ha una sessione valida.
  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && session.role !== 'admin') {
    return unauthorized();
  }
  if ((pathname === '/consultant' || pathname.startsWith('/consultant/')) && session.role !== 'admin' && session.role !== 'consultant') {
    return unauthorized();
  }
  if ((pathname === '/api/admin' || pathname.startsWith('/api/admin/')) && session.role !== 'admin') {
    return unauthorized();
  }
  if ((pathname === '/api/consultant' || pathname.startsWith('/api/consultant/')) && session.role !== 'admin' && session.role !== 'consultant') {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)',
  ],
};
