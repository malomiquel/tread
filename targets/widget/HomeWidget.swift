import SwiftUI
import UIKit
import WidgetKit

/**
 The home-screen widget: the week so far, and the next planned session.

 Everything it shows is a sentence the app has already written, in the app's
 language and units, into storage shared through the app group. The widget
 cannot read the database, and should not have to: this way it says exactly
 what the app says, and the app decides when it changes.
 */

/// Same group as in app.json and src/lib/homeWidget.ts.
private let appGroup = "group.com.malomiquel.tread"
/// Same key as in src/lib/homeWidget.ts.
private let summaryKey = "summary"

private let homeAccentLight = Color(red: 0.000, green: 0.204, blue: 0.561)
private let homeAccentDark = Color(red: 0.435, green: 0.659, blue: 1.000)

/// Only the faces bundled with this extension (see Info.plist): SemiBold,
/// Bold and ExtraBold. Any other name would fall back to the system font.

/// The widget gallery's own words, which the app never gets to write.
private let galleryFrench = Locale.preferredLanguages.first?.hasPrefix("fr") ?? false

/// The shape of what src/lib/widgetSnapshot.ts writes.
struct HomeSummary: Codable {
  struct Next: Codable {
    let when: String
    let name: String
    let detail: String
  }

  let thisWeek: String
  let distance: String
  let unit: String
  let detail: String
  let goalShare: Double?
  let goalText: String?
  let nextTitle: String
  let next: Next?
  let noPlan: String

  /// Shown in the widget gallery, before the app has written anything.
  static let sample = HomeSummary(
    thisWeek: galleryFrench ? "Cette semaine" : "This week",
    distance: galleryFrench ? "18,4" : "18.4",
    unit: "km",
    detail: galleryFrench ? "3 courses" : "3 runs",
    goalShare: 0.74,
    goalText: galleryFrench ? "6,6 km pour tenir 25 km" : "6.6 km to go of 25 km",
    nextTitle: galleryFrench ? "Prochaine séance" : "Next session",
    next: Next(
      when: galleryFrench ? "Demain" : "Tomorrow",
      name: galleryFrench ? "Footing 40 min" : "Easy run 40 min",
      detail: galleryFrench ? "Footing · 5'40\"/km" : "Easy run · 5'40\"/km"
    ),
    noPlan: galleryFrench ? "Aucun programme en cours" : "No training plan"
  )
}

private func readSummary() -> HomeSummary? {
  guard
    let text = UserDefaults(suiteName: appGroup)?.string(forKey: summaryKey),
    let data = text.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(HomeSummary.self, from: data)
}

struct HomeEntry: TimelineEntry {
  let date: Date
  let summary: HomeSummary?
}

struct HomeProvider: TimelineProvider {
  func placeholder(in context: Context) -> HomeEntry {
    HomeEntry(date: .now, summary: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeEntry) -> Void) {
    completion(HomeEntry(date: .now, summary: readSummary() ?? .sample))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeEntry>) -> Void) {
    // The app asks for a reload whenever it rewrites the summary; this only
    // makes sure the widget looks again now and then on its own.
    let later = Calendar.current.date(byAdding: .hour, value: 2, to: .now) ?? .now
    completion(Timeline(entries: [HomeEntry(date: .now, summary: readSummary())], policy: .after(later)))
  }
}

struct HomeWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme
  let entry: HomeEntry

  private var accent: Color { scheme == .dark ? homeAccentDark : homeAccentLight }

  var body: some View {
    if let summary = entry.summary {
      if family == .systemMedium {
        HStack(alignment: .top, spacing: 16) {
          week(summary)
          next(summary)
        }
      } else {
        week(summary)
      }
    } else {
      Text("Tread")
        .font(.custom("BarlowCondensed-Bold", size: 24))
        .foregroundStyle(accent)
    }
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
          .lineLimit(2)
      } else {
        Text(summary.detail)
          .font(.custom("BarlowCondensed-SemiBold", size: 14))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func next(_ summary: HomeSummary) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      label(summary.nextTitle)
      if let next = summary.next {
        Text(next.when)
          .font(.custom("BarlowCondensed-SemiBold", size: 15))
          .foregroundStyle(accent)
        Text(next.name)
          .font(.custom("BarlowCondensed-SemiBold", size: 19))
          .lineLimit(2)
        Text(next.detail)
          .font(.custom("BarlowCondensed-SemiBold", size: 13))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text(summary.noPlan)
          .font(.custom("BarlowCondensed-SemiBold", size: 15))
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct HomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TreadHome", provider: HomeProvider()) { entry in
      if #available(iOS 17.0, *) {
        HomeWidgetView(entry: entry)
          .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
      } else {
        HomeWidgetView(entry: entry)
          .padding()
          .background(Color(uiColor: .systemBackground))
      }
    }
    .configurationDisplayName("Tread")
    .description(galleryFrench ? "Ta semaine et ta prochaine séance." : "Your week and your next session.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
