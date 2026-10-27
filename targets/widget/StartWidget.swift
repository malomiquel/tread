import SwiftUI
import UIKit
import WidgetKit

/**
 The home-screen widget that starts a run.

 It shows nothing that changes, so it has no timeline to speak of: one entry,
 never reloaded. A tap opens the app on the run screen with `start=1`, which
 the screen reads as "begin now" (see RecordScreen in src/app/record.tsx).
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
}

struct StartProvider: TimelineProvider {
  func placeholder(in context: Context) -> StartEntry { StartEntry(date: .now) }

  func getSnapshot(in context: Context, completion: @escaping (StartEntry) -> Void) {
    completion(StartEntry(date: .now))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StartEntry>) -> Void) {
    completion(Timeline(entries: [StartEntry(date: .now)], policy: .never))
  }
}

struct StartWidgetView: View {
  @Environment(\.colorScheme) private var scheme

  private var accent: Color { scheme == .dark ? startAccentDark : startAccentLight }
  private var onAccent: Color { scheme == .dark ? startAccentTextDark : startAccentTextLight }

  var body: some View {
    VStack(spacing: 8) {
      ZStack {
        Circle().fill(accent)
        Image(systemName: "play.fill")
          .font(.system(size: 26))
          .foregroundStyle(onAccent)
          // A triangle centred geometrically looks off-centre: its mass sits left.
          .offset(x: 3)
      }
      .frame(width: 64, height: 64)
      Text(startFrench ? "Courir" : "Run")
        .font(.custom("BarlowCondensed-SemiBold", size: 20))
        .foregroundStyle(.primary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(startURL)
  }
}

struct StartWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TreadStart", provider: StartProvider()) { _ in
      if #available(iOS 17.0, *) {
        StartWidgetView()
          .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
      } else {
        StartWidgetView()
          .padding()
          .background(Color(uiColor: .systemBackground))
      }
    }
    .configurationDisplayName(startFrench ? "Courir" : "Run")
    .description(startFrench ? "Lance une course en un toucher." : "Start a run with one tap.")
    .supportedFamilies([.systemSmall])
  }
}
