import { NextResponse, type NextRequest } from 'next/server';

/** zesty.charisma.rocks (and zesty.localhost in dev) serves the Zesty page from this app. */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('zesty.') && !req.nextUrl.pathname.startsWith('/zesty')) {
    const url = req.nextUrl.clone();
    url.pathname = `/zesty${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes, Next assets and static files are served as-is on every host
  matcher: ['/((?!api|_next|fonts|favicon\\.ico|.*\\..*).*)'],
};
