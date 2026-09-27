// Notification deep links come in two shapes: route paths from HQ
// ("/(tabs)/deals?seg=invites") and scheme links from IQ ("formula://scripts/<id>",
// "formula://brain", "formula://credits", "formula://settings/instagram").
// Resolve both to an Expo Router path; unknown links open the notifications list.

const SCHEME: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^brain\/?$/i, () => '/(tabs)'],
  [/^scripts?\/([^/?#]+)/i, (m) => `/script/${m[1]}`],
  [/^credits\/?$/i, () => '/(tabs)/profile'],
  [/^settings(\/.*)?$/i, () => '/(tabs)/profile'],
  [/^deals(\?.*)?$/i, (m) => `/(tabs)/deals${m[1] ?? ''}`],
  [/^payouts\/?$/i, () => '/payouts'],
  [/^notifications\/?$/i, () => '/notifications'],
  [/^tools\/?$/i, () => '/(tabs)/tools'],
  [/^saved(\?.*)?$/i, (m) => `/(tabs)/scripts${m[1] ?? ''}`],
];

export function resolveDeepLink(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/notifications';
  if (raw.startsWith('/')) return raw;
  const m = raw.match(/^(?:formula|exp\+formula):\/\/(.*)$/i);
  if (!m) return '/notifications';
  const rest = m[1];
  for (const [re, to] of SCHEME) {
    const mm = rest.match(re);
    if (mm) return to(mm);
  }
  return rest.startsWith('(') ? `/${rest}` : '/notifications';
}
