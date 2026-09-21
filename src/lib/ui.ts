import { useSyncExternalStore } from "react";

/**
 * A scrap of interface state that has to be read outside the screen that owns
 * it.
 *
 * The tab bar is rendered by the navigator, above every screen, so a screen
 * cannot hide it by returning different markup. Since the bar is drawn by our
 * own component, the simplest honest route is a tiny shared store both sides
 * can read, rather than threading a prop through the navigator.
 */
let mapExpanded = false;
const listeners = new Set<() => void>();

export function setMapExpanded(value: boolean): void {
  if (mapExpanded === value) return;
  mapExpanded = value;
  for (const listener of listeners) listener();
}

const getSnapshot = () => mapExpanded;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMapExpanded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
