import ExpoModulesCore
import TikTokOpenSDKCore

/**
 * Routes TikTok's auth callback back into the SDK. TikTok returns to the app
 * two ways, and we must catch both:
 *   - App-to-app: a custom-scheme URL (<clientKey>://response.bridge.tiktok.com/oauth)
 *     delivered via application(_:open:options:).
 *   - Web-view fallback: the Universal Link (https://iq.influenceish.com/tiktok/native)
 *     delivered via application(_:continue:restorationHandler:).
 * TikTokURLHandler.handleOpenURL returns true when it consumed the URL.
 */
public class TikTokLoginAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return TikTokURLHandler.handleOpenURL(url)
  }

  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
      return TikTokURLHandler.handleOpenURL(userActivity.webpageURL)
    }
    return false
  }
}
