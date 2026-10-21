// Game state lives in localStorage, so render in the browser only.
export const ssr = false;
// Build an HTML shell for "/" so the service worker can cache it for offline use.
export const prerender = true;
