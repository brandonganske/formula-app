import ExpoModulesCore
import TikTokOpenSDKCore
import TikTokOpenAuthSDK
import TikTokOpenShareSDK

/**
 * Native TikTok Login Kit (OpenSDK v2) app-to-app authorization.
 *
 * `authenticate(scopes, redirectURI)` opens the TikTok app (or TikTok's own
 * in-app web-view when TikTok isn't installed) and resolves with the
 * authorization `code` AND the PKCE `codeVerifier`. The SDK generates PKCE
 * internally and only sends the code_challenge to TikTok, so the server-side
 * token exchange (/api/v1/auth/tiktok-native) MUST receive this codeVerifier.
 *
 * The client key is read from Info.plist `TikTokClientKey` by the SDK (set by
 * the config plugin). `redirectURI` must be the Universal Link registered in
 * the TikTok portal and backed by this app's associated-domains entitlement.
 */
public class TikTokLoginModule: Module {
  // TikTokAPI holds pending requests WEAKLY (NSMapTable.strongToWeakObjects).
  // We must keep our own strong reference alive until TikTok calls back, or the
  // request is deallocated and the return URL can never be routed to it.
  private var pendingRequest: TikTokAuthRequest?
  private var pendingShare: TikTokShareRequest?

  public func definition() -> ModuleDefinition {
    Name("TikTokLogin")

    // Best-effort check; requires `tiktokopensdk` in LSApplicationQueriesSchemes.
    Function("isTikTokAppInstalled") { () -> Bool in
      guard let url = URL(string: "tiktokopensdk://") else { return false }
      return UIApplication.shared.canOpenURL(url)
    }

    // Route a return URL into the SDK from JS. The AppDelegate subscriber also
    // does this for the Universal Link, but Expo Router reliably receives the
    // deep link in JS too, so the /tiktok/native screen calls this as a
    // guaranteed path. Calling twice is harmless — the second finds no pending
    // request and returns false. Returns true if the SDK consumed the URL.
    Function("handleReturnURL") { (url: String) -> Bool in
      guard let u = URL(string: url) else { return false }
      return TikTokURLHandler.handleOpenURL(u)
    }

    // Share Kit: hand videos (Photos local identifiers) to the TikTok app,
    // which opens its own editor so the creator adds caption, sound and the
    // product tag there. Resolves once TikTok returns to us.
    AsyncFunction("shareVideos") { (localIdentifiers: [String], redirectURI: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        let request = TikTokShareRequest(localIdentifiers: localIdentifiers, mediaType: .video, redirectURI: redirectURI)
        self?.pendingShare = request
        request.send { [weak self] response in
          self?.pendingShare = nil
          guard let res = response as? TikTokShareResponse else {
            promise.resolve(["isSuccess": false, "errorCode": -1, "errorMsg": "Unexpected response from TikTok."] as [String: Any])
            return
          }
          if res.errorCode == .noError {
            promise.resolve(["isSuccess": true, "shareState": res.shareState.rawValue] as [String: Any])
          } else {
            promise.resolve([
              "isSuccess": false,
              "errorCode": res.errorCode.rawValue,
              "shareState": res.shareState.rawValue,
              "errorMsg": res.errorDescription ?? "Sharing to TikTok was cancelled or failed.",
            ] as [String: Any])
          }
        }
      }
    }

    AsyncFunction("authenticate") { (scopes: [String], redirectURI: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        let requestedScopes = Set(scopes.isEmpty ? ["user.info.basic"] : scopes)
        let request = TikTokAuthRequest(scopes: requestedScopes, redirectURI: redirectURI)
        // Capture the SDK-generated PKCE verifier now; the server needs it to
        // complete the token exchange for the code TikTok returns.
        let codeVerifier = request.pkce.codeVerifier
        // Strongly retain the request until the callback fires (see above).
        self?.pendingRequest = request

        request.send { [weak self] response in
          self?.pendingRequest = nil
          guard let res = response as? TikTokAuthResponse else {
            promise.resolve([
              "isSuccess": false,
              "errorCode": -1,
              "errorMsg": "Unexpected response from TikTok.",
            ] as [String: Any])
            return
          }

          if res.errorCode == .noError, let code = res.authCode, !code.isEmpty {
            var result: [String: Any] = [
              "isSuccess": true,
              "code": code,
              "codeVerifier": codeVerifier,
            ]
            if let granted = res.grantedPermissions {
              result["grantedPermissions"] = Array(granted)
            }
            if let state = res.state { result["state"] = state }
            promise.resolve(result)
          } else {
            promise.resolve([
              "isSuccess": false,
              "errorCode": res.errorCode.rawValue,
              "errorMsg": res.errorDescription ?? res.error ?? "TikTok sign-in was cancelled or failed.",
            ] as [String: Any])
          }
        }
      }
    }
  }
}
