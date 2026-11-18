import SwiftUI
import UIKit
import WidgetKit

/**
 The home-screen widget that starts a run, with the week beside the button.

 The week and the next session are the same sentences HomeWidget reads from
 the app group. A tap anywhere opens the app on the run screen with
 `start=1`, which the screen reads as "begin now" (see RecordScreen in
 src/app/record.tsx).
 */

private let startAccentLight = Color(red: 0.000, green: 0.204, blue: 0.561)
private let startAccentDark = Color(red: 0.435, green: 0.659, blue: 1.000)
private let startAccentTextLight = Color.white
private let startAccentTextDark = Color(red: 0.016, green: 0.063, blue: 0.122)

/// Same scheme as app.json; same path and query as the route in src/app.
private let startURL = URL(string: "tread://record?start=1")!

private let startFrench = Locale.preferredLanguages.first?.hasPrefix("fr") ?? false

struct StartEntry: TimelineEntry {
  let date: Date
  let summary: HomeSummary?
}

struct StartProvider: TimelineProvider {
  func placeholder(in context: Context) -> StartEntry { StartEntry(date: .now, summary: .sample) }

  func getSnapshot(in context: Context, completion: @escaping (StartEntry) -> Void) {
    completion(StartEntry(date: .now, summary: readSummary() ?? .sample))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StartEntry>) -> Void) {
    // The app reloads the widget whenever it rewrites the summary.
    let later = Calendar.current.date(byAdding: .hour, value: 2, to: .now) ?? .now
    completion(Timeline(entries: [StartEntry(date: .now, summary: readSummary())], policy: .after(later)))
  }
}

struct StartWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme
  let entry: StartEntry

  private var accent: Color { scheme == .dark ? startAccentDark : startAccentLight }
  private var onAccent: Color { scheme == .dark ? startAccentTextDark : startAccentTextLight }

  var body: some View {
    Group {
      if let summary = entry.summary {
        if family == .systemMedium {
          HStack(alignment: .top, spacing: 16) {
            week(summary)
            VStack(alignment: .leading, spacing: 3) {
              next(summary)
              Spacer(minLength: 0)
              button
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          }
        } else {
          VStack(alignment: .leading, spacing: 0) {
            week(summary)
            button
          }
        }
      } else {
        button.frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .widgetURL(startURL)
  }

  /// The run disc as a pill, with its word: an icon never stands alone.
  private var button: some View {
    HStack(spacing: 6) {
      Image(systemName: "play.fill")
        .font(.system(size: 12))
        // A triangle centred geometrically looks off-centre: its mass sits left.
        .offset(x: 1)
      Text(startFrench ? "Courir" : "Run")
        .font(.custom("BarlowCondensed-Bold", size: 18))
    }
    .foregroundStyle(onAccent)
    .frame(maxWidth: .infinity)
    .frame(height: 32)
    .background(accent, in: Capsule())
  }

  private func label(_ text: String) -> some View {
    Text(text.uppercased())
      .font(.custom("BarlowCondensed-SemiBold", size: 12))
      .tracking(1)
      .foregroundStyle(.secondary)
  }

  private func week(_ summary: HomeSummary) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      label(summary.thisWeek)
      HStack(alignment: .firstTextBaseline, spacing: 3) {
        Text(summary.distance)
          .font(.custom("BarlowCondensed-SemiBold", size: 38))
          .monospacedDigit()
          .foregroundStyle(accent)
        Text(summary.unit)
          .font(.custom("BarlowCondensed-SemiBold", size: 16))
          .foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      if let share = summary.goalShare {
        ProgressView(value: share).tint(accent)
        Text(summary.goalText ?? "")
          .font(.custom("BarlowCondensed-SemiBold", size: 13))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text(summary.detail)
          .font(.custom("BarlowCondensed-SemiBold", size: 14))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  @ViewBuilder
  private func next(_ summary: HomeSummary) -> some View {
    label(summary.nextTitle)
    if let next = summary.next {
      Text(next.when)
        .font(.custom("BarlowCondensed-SemiBold", size: 15))
        .foregroundStyle(accent)
      Text(next.name)
        .font(.custom("BarlowCondensed-SemiBold", size: 19))
        .lineLimit(2)
    } else {
      Text(summary.noPlan)
        .font(.custom("BarlowCondensed-SemiBold", size: 15))
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
  }
}

struct StartWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TreadStart", provider: StartProvider()) { entry in
      if #available(iOS 17.0, *) {
        StartWidgetView(entry: entry)
          .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
      } else {
        StartWidgetView(entry: entry)
          .padding()
          .background(Color(uiColor: .systemBackground))
      }
    }
    .configurationDisplayName(startFrench ? "Courir" : "Run")
    .description(startFrench ? "Ta semaine, et une course en un toucher." : "Your week, and a run in one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
