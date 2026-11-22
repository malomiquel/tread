Pod::Spec.new do |s|
  s.name           = 'ZipFile'
  s.version        = '1.0.0'
  s.summary        = 'Zips one file natively'
  s.description    = 'Deflates one file into a zip archive off the JavaScript thread.'
  s.license        = 'MIT'
  s.author         = 'Tread'
  s.homepage       = 'https://github.com/malomiquel/tread'
  s.platforms      = { :ios => '16.2' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
