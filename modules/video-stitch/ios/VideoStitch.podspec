Pod::Spec.new do |s|
  s.name           = 'VideoStitch'
  s.version        = '1.0.0'
  s.summary        = 'Concatenate recorded clips into one video (AVFoundation).'
  s.author         = 'Influenceish'
  s.homepage       = 'https://thecreatorformula.com'
  s.platforms      = { :ios => '13.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
