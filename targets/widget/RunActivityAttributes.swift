import ActivityKit
import Foundation

/**
 Shape of the Live Activity shown while a run is recording.

 This file exists twice, once here and once under modules/live-activity/ios,
 and the two copies must stay byte for byte identical. They cannot be one
 file: CocoaPods refuses to compile sources from outside a pod's own folder,
 and the widget extension cannot reach inside that pod either. ActivityKit
 pairs the app's activity with the widget's declaration by this type, so a
 difference between the copies would break the pairing silently. A test in
 src/lib/liveActivity.test.ts compares them on every run, which is what makes
 the duplication safe rather than merely tolerated.

 Everything here except the clock is a string the app has already formatted.
 The app knows how it writes a distance and a pace, in French, and this way
 the lock screen says it exactly the same way rather than reimplementing it
 in Swift against a second locale.
 */
struct RunActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /**
     The instant the clock would have started from had the run never been
     paused, or nil while it is paused.

     Live Activities cannot be updated every second — the system throttles
     that hard, and it would drain the battery for a number the phone can
     work out on its own. So the app hands over an origin instead of an
     elapsed time, and SwiftUI counts up from it without being told again.
     Pausing shifts the origin forward by however long the pause lasted, so
     the clock picks up where it stopped.
     */
    var clockOrigin: Date?
    /** The elapsed time as text, for when the clock is stopped. */
    var elapsed: String
    /** Distance in kilometres, already formatted, without its unit. */
    var distance: String
    /// "km" or "mi", as the app shows it; the distance above is already in it.
    var distanceUnit: String
    /** Pace per kilometre, already formatted, without its unit. */
    var pace: String
    /// "/km" or "/mi".
    var paceUnit: String
  }

  /** The run's name, fixed for the whole activity. */
  var title: String
}
