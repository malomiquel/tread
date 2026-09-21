import ActivityKit
import ExpoModulesCore

/**
 What JavaScript sends over. The numbers are already strings because the app
 formats them itself, in French, and the lock screen should read exactly like
 the screen it mirrors. Only the clock crosses as a date, so that the system
 can keep counting without being woken up every second.
 */
struct RunActivityState: Record {
  @Field var clockOriginMs: Double?
  @Field var elapsed: String = "00:00"
  @Field var distance: String = "0,00"
  @Field var pace: String = "--'--"
}

@available(iOS 16.2, *)
private func content(from state: RunActivityState) -> ActivityContent<RunActivityAttributes.ContentState> {
  ActivityContent(
    state: RunActivityAttributes.ContentState(
      clockOrigin: state.clockOriginMs.map { Date(timeIntervalSince1970: $0 / 1000) },
      elapsed: state.elapsed,
      distance: state.distance,
      pace: state.pace
    ),
    // No stale date: a run's numbers stop being true the moment the phone
    // stops hearing from the app, and there is nothing useful to show then
    // beyond what is already on screen.
    staleDate: nil
  )
}

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    /**
     Live Activities exist from iOS 16.2, and can be switched off per app in
     Settings. Both have to be true, and the second can change while the app
     is running, so this is read each time rather than cached.
     */
    Function("isAvailable") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (title: String, state: RunActivityState) -> String? in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
        return nil
      }

      // A run left over from a previous launch — the app killed mid-session —
      // would otherwise sit on the lock screen next to the new one.
      for stale in Activity<RunActivityAttributes>.activities {
        await stale.end(nil, dismissalPolicy: .immediate)
      }

      do {
        let activity = try Activity.request(
          attributes: RunActivityAttributes(title: title),
          content: content(from: state),
          pushType: nil
        )
        return activity.id
      } catch {
        // Requesting can fail for reasons the app cannot fix: too many
        // activities, or the user having turned them off a moment ago. The
        // run itself is unaffected, so this is reported as "no activity".
        return nil
      }
    }

    AsyncFunction("update") { (id: String, state: RunActivityState) -> Void in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<RunActivityAttributes>.activities.first(where: { $0.id == id })
      else { return }
      await activity.update(content(from: state))
    }

    /**
     Clears the lock screen, whatever put something there. Ending is always
     immediate and always total: there is only ever one run, and a finished
     one has nothing left to say that the summary screen does not say better.
     */
    AsyncFunction("stop") { () -> Void in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
