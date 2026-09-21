import ActivityKit
import SwiftUI
import WidgetKit

/**
 The app's cobalt, as two literals rather than a shared token: a widget
 extension is a separate binary and cannot reach into the app's JavaScript
 palette. These are the same values as `accent` in src/lib/theme.ts.
 */
private let accentLight = Color(red: 0.000, green: 0.204, blue: 0.561)
private let accentDark = Color(red: 0.435, green: 0.659, blue: 1.000)

/**
 Barlow Condensed, the app's own face, carried inside this extension.

 An extension is a separate binary and sees none of the fonts the app
 registers, so the files travel with it and are declared in its Info.plist.
 Weights are chosen by name rather than by asking for a weight: each one is
 its own file, and asking on top would have the system smear a synthetic bold
 over an already bold face.

 The sizes are larger than the system font's were. A condensed face is
 narrower and shorter in the eye, so the same point size reads noticeably
 smaller — the same correction the app itself needed.
 */
private enum Face {
  static func semibold(_ size: CGFloat) -> Font { .custom("BarlowCondensed-SemiBold", size: size) }
  static func bold(_ size: CGFloat) -> Font { .custom("BarlowCondensed-Bold", size: size) }
  static func extrabold(_ size: CGFloat) -> Font { .custom("BarlowCondensed-ExtraBold", size: size) }
}

/**
 A run has no end, so the clock is given a range it will never reach rather
 than a finish line. A week is far beyond any run and keeps the formatter on
 hours, minutes and seconds.
 */
private func openEnded(from origin: Date) -> ClosedRange<Date> {
  origin...origin.addingTimeInterval(7 * 24 * 60 * 60)
}

/** One figure above its label, the way the app itself sets a metric. */
private struct Metric: View {
  let value: String
  let unit: String
  let label: String
  var accent: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(alignment: .firstTextBaseline, spacing: 2) {
        Text(value)
          .font(Face.semibold(28))
          .monospacedDigit()
        Text(unit)
          .font(Face.semibold(14))
          .foregroundStyle(.secondary)
      }
      Text(label)
        .font(Face.semibold(11.5))
        .tracking(1.2)
        .foregroundStyle(.tertiary)
    }
  }
}

private struct LockScreenView: View {
  let title: String
  let state: RunActivityAttributes.ContentState
  @Environment(\.colorScheme) private var scheme

  private var accent: Color { scheme == .dark ? accentDark : accentLight }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 6) {
        Image(systemName: state.clockOrigin == nil ? "pause.fill" : "figure.run")
          .font(.system(size: 11, weight: .bold))
        Text(state.clockOrigin == nil ? "EN PAUSE" : title.uppercased())
          .font(Face.semibold(13))
          .tracking(1.2)
          .lineLimit(1)
      }
      .foregroundStyle(accent)

      HStack(alignment: .firstTextBaseline) {
        // The clock counts on its own between updates; everything beside it
        // only changes when the app has something new to say.
        VStack(alignment: .leading, spacing: 1) {
          Group {
            if let origin = state.clockOrigin {
              Text(timerInterval: openEnded(from: origin), countsDown: false)
            } else {
              Text(state.elapsed)
            }
          }
          .font(Face.bold(44))
          .monospacedDigit()

          Text("TEMPS")
            .font(Face.semibold(11.5))
            .tracking(1.2)
            .foregroundStyle(.tertiary)
        }

        // One flexible gap, not two: distance and pace are a pair and keep a
        // fixed distance from each other, while all the slack goes between
        // them and the clock. Two spacers shared the slack evenly, which left
        // the pace crowding the distance's unit.
        Spacer(minLength: 16)
        HStack(alignment: .firstTextBaseline, spacing: 26) {
          Metric(value: state.distance, unit: "km", label: "DISTANCE", accent: accent)
          Metric(value: state.pace, unit: "/km", label: "ALLURE", accent: accent)
        }
      }
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 16)
  }
}

struct RunLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RunActivityAttributes.self) { context in
      LockScreenView(title: context.attributes.title, state: context.state)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Metric(value: context.state.distance, unit: "km", label: "DISTANCE", accent: accentDark)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Metric(value: context.state.pace, unit: "/km", label: "ALLURE", accent: accentDark)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Group {
            if let origin = context.state.clockOrigin {
              Text(timerInterval: openEnded(from: origin), countsDown: false)
            } else {
              Text(context.state.elapsed)
            }
          }
          .font(Face.bold(39))
          .monospacedDigit()
          .frame(maxWidth: .infinity)
        }
      } compactLeading: {
        Image(systemName: context.state.clockOrigin == nil ? "pause.fill" : "figure.run")
          .foregroundStyle(accentDark)
      } compactTrailing: {
        // The compact slot is narrow, so the distance goes here and the clock
        // waits for the expanded view: a number that changes every second
        // would be unreadable at this size anyway.
        Text(context.state.distance)
          .monospacedDigit()
          .foregroundStyle(accentDark)
      } minimal: {
        Image(systemName: "figure.run")
          .foregroundStyle(accentDark)
      }
    }
  }
}

@main
struct TreadWidgets: WidgetBundle {
  var body: some Widget {
    RunLiveActivity()
  }
}
