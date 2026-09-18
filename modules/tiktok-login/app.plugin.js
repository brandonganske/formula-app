const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Config plugin for the native TikTok Login module.
 *
 * Options:
 *   clientKey            (required) TikTok Login Kit client key.
 *   universalLinkDomains (optional) domains for the associated-domains
 *                        entitlement backing the Universal Link redirect.
 *                        Default: ['iq.influenceish.com'].
 *
 * Sets, on iOS:
 *   - Info.plist TikTokClientKey (the SDK reads this to identify the app).
 *   - CFBundleURLTypes: a URL scheme == clientKey, so TikTok's app-to-app
 *     bridge callback (<clientKey>://response.bridge.tiktok.com/oauth) routes
 *     back to this app.
 *   - LSApplicationQueriesSchemes: the schemes the SDK probes to open TikTok.
 *   - com.apple.developer.associated-domains: applinks: + webcredentials: for
 *     the Universal Link, so the web-view fallback can return to the app.
 */
const TIKTOK_QUERY_SCHEMES = ['tiktokopensdk', 'tiktoksharesdk', 'snssdk1180', 'snssdk1233'];

function withTikTokInfoPlist(config, { clientKey }) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    plist.TikTokClientKey = clientKey;

    // URL scheme = clientKey for the app-to-app bridge return.
    plist.CFBundleURLTypes = plist.CFBundleURLTypes || [];
    const hasScheme = plist.CFBundleURLTypes.some(
      (t) => Array.isArray(t.CFBundleURLSchemes) && t.CFBundleURLSchemes.includes(clientKey),
    );
    if (!hasScheme) {
      plist.CFBundleURLTypes.push({
        CFBundleURLName: 'tiktok',
        CFBundleURLSchemes: [clientKey],
      });
    }

    // Schemes the SDK queries via canOpenURL to reach the TikTok app.
    plist.LSApplicationQueriesSchemes = Array.from(
      new Set([...(plist.LSApplicationQueriesSchemes || []), ...TIKTOK_QUERY_SCHEMES]),
    );

    return cfg;
  });
}

function withTikTokAssociatedDomains(config, { universalLinkDomains }) {
  return withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.developer.associated-domains';
    const existing = cfg.modResults[key] || [];
    const additions = [];
    for (const domain of universalLinkDomains) {
      additions.push(`applinks:${domain}`);
      additions.push(`webcredentials:${domain}`);
    }
    cfg.modResults[key] = Array.from(new Set([...existing, ...additions]));
    return cfg;
  });
}

module.exports = function withTikTokLogin(config, options = {}) {
  const clientKey = options.clientKey;
  if (!clientKey) {
    throw new Error('[tiktok-login] config plugin requires a `clientKey` option.');
  }
  const universalLinkDomains =
    options.universalLinkDomains && options.universalLinkDomains.length
      ? options.universalLinkDomains
      : ['iq.influenceish.com'];

  config = withTikTokInfoPlist(config, { clientKey });
  config = withTikTokAssociatedDomains(config, { universalLinkDomains });
  return config;
};
