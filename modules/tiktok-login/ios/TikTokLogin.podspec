Pod::Spec.new do |s|
  s.name           = 'TikTokLogin'
  s.version        = '1.0.0'
  s.summary        = 'Native TikTok Login Kit (OpenSDK v2) app-to-app auth for Formula.'
  s.description    = 'Expo module wrapping TikTokOpenAuthSDK for native app-to-app TikTok login with a web-view fallback.'
  s.author         = 'Influenceish'
  s.homepage       = 'https://thecreatorformula.com'
  s.platforms      = { :ios => '13.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TikTokOpenSDKCore'
  s.dependency 'TikTokOpenAuthSDK'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
