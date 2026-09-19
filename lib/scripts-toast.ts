// A one-line event bus so any screen can say "a script was just used" and the
// tab-level toast shows the new balance. No provider needed.
type Listener = (cost: number) => void;
const listeners = new Set<Listener>();

export function notifyScriptUsed(cost = 1) { listeners.forEach((l) => l(cost)); }
export function onScriptUsed(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
