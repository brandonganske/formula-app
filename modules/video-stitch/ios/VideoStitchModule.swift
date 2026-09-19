import ExpoModulesCore
import AVFoundation

/**
 * Stitches several MP4/MOV clips (same camera, same orientation) into one file.
 * iOS can't pause a recording, so the teleprompter records one clip per
 * press and joins them here on "Done" — the CapCut multi-clip model.
 */
public class VideoStitchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoStitch")

    AsyncFunction("stitch") { (uris: [String], promise: Promise) in
      let composition = AVMutableComposition()
      guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
        promise.reject("E_TRACK", "Could not create a video track"); return
      }
      let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      var cursor = CMTime.zero
      var transform: CGAffineTransform? = nil
      var naturalSize: CGSize = .zero

      for raw in uris {
        let url = raw.hasPrefix("file://") ? URL(string: raw)! : URL(fileURLWithPath: raw)
        let asset = AVURLAsset(url: url)
        guard let v = asset.tracks(withMediaType: .video).first else { continue }
        let range = CMTimeRange(start: .zero, duration: asset.duration)
        do {
          try videoTrack.insertTimeRange(range, of: v, at: cursor)
          if let a = asset.tracks(withMediaType: .audio).first, let at = audioTrack {
            try at.insertTimeRange(range, of: a, at: cursor)
          }
        } catch {
          promise.reject("E_INSERT", "Could not add a clip: \(error.localizedDescription)"); return
        }
        if transform == nil { transform = v.preferredTransform; naturalSize = v.naturalSize }
        cursor = CMTimeAdd(cursor, asset.duration)
      }
      if let t = transform { videoTrack.preferredTransform = t }
      if CMTimeCompare(cursor, .zero) == 0 { promise.reject("E_EMPTY", "No clips to stitch"); return }

      let out = FileManager.default.temporaryDirectory.appendingPathComponent("stitched-\(Int(Date().timeIntervalSince1970)).mp4")
      guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
        promise.reject("E_EXPORT", "Could not create an export session"); return
      }
      export.outputURL = out
      export.outputFileType = .mp4
      export.shouldOptimizeForNetworkUse = true
      export.exportAsynchronously {
        switch export.status {
        case .completed: promise.resolve(out.absoluteString)
        default: promise.reject("E_EXPORT", export.error?.localizedDescription ?? "Export failed")
        }
      }
    }
  }
}
