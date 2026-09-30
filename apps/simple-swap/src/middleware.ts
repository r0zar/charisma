import { NextResponse, type NextRequest } from 'next/server';

/** Subdomains served from this app: zesty.charisma.rocks → /zesty, wallet.charisma.rocks → /wallet (and *.localhost in dev). */
const SUBDOMAIN_APPS = ['zesty', 'wallet'];

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const app = SUBDOMAIN_APPS.find(name => host.startsWith(`${name}.`));
  if (app && !req.nextUrl.pathname.startsWith(`/${app}`)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${app}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes, Next assets and static files are served as-is on every host
  matcher: ['/((?!api|_next|fonts|favicon\\.ico|.*\\..*).*)'],
};
