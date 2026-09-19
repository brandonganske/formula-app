// Expo Router calls this for every URL the OS hands the app. Links from the
// share extension look like `formula://dataUrl=…`; they are not routes, so
// send them to the tabs and let the ShareIntent handler in _layout push
// /share once the intent is read. Everything else passes through untouched.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (/dataUrl=|ShareKey=|share-intent/i.test(path)) return '/(tabs)';
  return path;
}
