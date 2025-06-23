// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: "https://72c5d85b6dff708d85c67a9b98981a86@o4508108453642240.ingest.us.sentry.io/4509354304995328",

    // Add optional integrations for additional features
    integrations: [
        Sentry.replayIntegration(),
        Sentry.browserTracingIntegration(),
        Sentry.browserProfilingIntegration()
    ],

    // Tracing
    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/[^/]+\.charisma\.rocks\/api/],
    // Set profilesSampleRate to 1.0 to profile every transaction.
    // Since profilesSampleRate is relative to tracesSampleRate,
    // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
    // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
    // results in 25% of transactions being profiled (0.5*0.5=0.25)
    profilesSampleRate: 1.0,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;