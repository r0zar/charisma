import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/v1/metadata',
  '/api/v1/bots', // Public bot listings
  '/api/cron/(.*)', // Allow cron jobs to run without auth
  // Add any other public API endpoints here
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through without authentication
  if (isPublicRoute(req)) {
    return;
  }

  // Protect all other routes by requiring authentication
  const { userId, redirectToSignIn } = await auth();
  
  if (!userId) {
    // Redirect to sign-in page for unauthenticated users
    return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};