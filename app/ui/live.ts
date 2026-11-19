import { useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
  return () => {};
}
const inBrowser = () => true;
const atBuildTime = () => false;

/**
 * False in the build-time HTML and in the first client render over it (so the two match),
 * true from then on, and from the start for anything first rendered in the browser.
 */
export function useLive(): boolean {
  return useSyncExternalStore(subscribeToNothing, inBrowser, atBuildTime);
}
