# Releasing Tread

How a build gets from this repository to testers' phones: TestFlight on
iOS, internal testing on Google Play. Everything that can be prepared in the
repository is; what is left is accounts, which only the owner can open.

## Why builds are local

The version and the build number are read from the git history
(`app.config.js`): feats and fixes counted, commits counted. EAS's cloud
builders work from a copy without that history, where every build would come
out as build 1 — and App Store Connect refuses a build number it has seen.
So builds run on this Mac with `--local`, and EAS does what it is best at:
the signing credentials (the app and its widget extension) and the upload.

Build numbers only ever go up because the commit count only ever goes up.
Build from a clean, committed tree: the app says so in Settings › About when
it was not.

## Once, before the first build

### Accounts (the only paid step)

- [ ] **Apple Developer Program**, 99 €/year, on the Apple ID of team
  `RJPC9JP6NY` — https://developer.apple.com/programs/
- [ ] **Expo account** (free) — https://expo.dev/signup
- [ ] **Google Play Console**, 25 $ once, for Android —
  https://play.google.com/console/signup

### Link the project

```sh
npx eas-cli login
npx eas-cli init          # writes the project id into app.json: commit it
```

### App Store Connect

- [ ] Create the app: My Apps › + › New App — platform iOS, name **Tread**,
  primary language French, bundle id `com.malomiquel.tread`, SKU `tread`.
- [ ] Note its **Apple ID** (App Information › General), a number, and put it
  in `eas.json` under `submit.production.ios.ascAppId`.
- [ ] Privacy policy URL (App Information): needed for external testers.
  See "Before selling" in ROADMAP.md.

Capabilities — App Groups (`group.com.malomiquel.tread`, shared with the
home-screen widget), HealthKit, background location — are declared in
app.json and synced to the Apple Developer portal by EAS on the first build.
If the build stops on a provisioning error mentioning the app group, create
the group by hand in Certificates, Identifiers & Profiles › Identifiers ›
App Groups, then build again.

The safety copy writes to iCloud Drive through the container
`iCloud.com.malomiquel.tread` (iCloud capability, CloudDocuments). If the
build stops on it, create the container in Identifiers › iCloud Containers,
tick it on the app identifier's iCloud capability, and build again.

## Each build

```sh
npm run typecheck && npm run lint && npm test
npm run release:ios        # builds dist/tread.ipa, then uploads it
```

The first run asks to sign in to Apple and offers to create the distribution
certificate and the profiles (answer yes to each); later runs reuse them.
A build appears in App Store Connect › TestFlight after about ten minutes of
processing.

Android, once the Play Console app exists (its **first** bundle has to be
uploaded by hand in the console; after that the script does it):

```sh
npm run release:android    # builds dist/tread.aab, then uploads it as a draft
```

## Inviting testers (TestFlight)

- **Internal** (up to 100, members of the App Store Connect team): TestFlight
  › Internal Testing › + — available as soon as the build is processed.
- **External** (up to 10,000, anybody): TestFlight › External Testing › + a
  group, add the build, fill in the text below, submit for Beta App Review
  (first build only, usually under a day). Then either add emails, or turn on
  the **public link** and share it anywhere.

Testers install TestFlight from the App Store and open the invitation. Each
build expires after 90 days.

### Beta App Description

> Tread est une app de course à pied : enregistre tes sorties, suis un
> programme vers ta course, dessine tes parcours et bats ton propre record
> dessus. Tout reste sur ton téléphone.

### What to Test

> Une sortie de bout en bout : démarrer avec le bouton du milieu, pause,
> arrivée. Un parcours dessiné ou importé, couru deux fois (guidage et
> fantôme). Les réglages en anglais et en miles. Dis-nous ce qui t'a perdu.

### Feedback email

The address set as `TREAD_SUPPORT_EMAIL` (see app.config.js), once it exists.
