/** Fired by apiFetch / the chat stream when the backend answers 402 insufficient_credits. */
export const CREDITS_NEEDED_EVENT = "credits:needed";
/** Fired after anything that spends credits, so the balance refreshes everywhere. */
export const CREDITS_CHANGED_EVENT = "credits:changed";

export function emitCreditsNeeded() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_NEEDED_EVENT));
}

export function emitCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}
