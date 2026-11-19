/**
 * The ads' consent, asked by Google's own consent message (AdSense's Privacy & messaging,
 * set up in AdSense; it shows itself to players in the UK, the EEA and Switzerland). The
 * site's part is a way back to it: "Privacy and cookie settings", which Google asks every
 * site to have at its foot. It reopens Google's message, through the one call Google
 * supports (`googlefc.callbackQueue.push(googlefc.showRevocationMessage)`: Privacy &
 * Messaging JavaScript API, developers.google.com/funding-choices/fc-api-docs).
 *
 * Browser only: call it from handlers.
 */

interface GoogleFc {
  callbackQueue?: unknown;
  showRevocationMessage?: unknown;
}

/**
 * Opens Google's consent message again, to change the choice made. False where it cannot:
 * Google's consent message is not on this page (nobody is asked where the player is, or it
 * has not loaded, or an ad blocker stopped it).
 */
export function openAdChoices(win: Window = window): boolean {
  const fc = (win as unknown as { googlefc?: GoogleFc }).googlefc;
  if (
    !fc ||
    !Array.isArray(fc.callbackQueue) ||
    typeof fc.showRevocationMessage !== "function"
  ) {
    return false;
  }
  fc.callbackQueue.push(fc.showRevocationMessage);
  return true;
}
