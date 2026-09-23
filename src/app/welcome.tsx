import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { healthAvailable, requestHealthAccess } from "@/lib/health";
import { defineStrings, useStrings } from "@/lib/i18n";
import { markWelcomed } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

/** Where a permission stands, as far as this screen can tell. */
type Access = "unknown" | "granted" | "refused" | "asked";

const welcomeStrings = defineStrings({
  fr: {
    headline: "Cours, progresse, et garde tout pour toi.",
    recordTitle: "Enregistre tes courses",
    recordDetail: "Distance, allure, dénivelé et tracé, même écran verrouillé et téléphone en poche.",
    planTitle: "Suis un programme",
    planDetail:
      "Du 5 km au marathon : des séances construites semaine par semaine jusqu'au jour de ta course.",
    routesTitle: "Trace tes parcours",
    routesDetail: "Dessine une boucle qui suit les rues, puis cours dessus en la voyant sur la carte.",
    note: "Pas de compte, pas de publicité. Tes courses restent sur ton téléphone.",
    continue: "Continuer",
    twoPermissions: "Deux autorisations",
    onePermission: "Une autorisation",
    permissionsLede:
      "Tu peux refuser : rien ne sera demandé en ton absence, et tu pourras changer d'avis dans les réglages du téléphone.",
    locationTitle: "Ta position",
    locationDetail:
      "Pour mesurer ta distance et dessiner ton tracé. Au départ d'une course, le téléphone proposera aussi de la garder écran éteint : accepte, sinon l'enregistrement s'arrête dès qu'il est dans ta poche.",
    openSettings: "Ouvrir les réglages",
    allow: "Autoriser",
    healthTitle: "Apple Santé",
    healthDetail:
      "Pour y copier tes courses, calculer tes calories avec ton poids, et afficher ta fréquence cardiaque si tu cours avec une montre.",
    connect: "Connecter",
    start: "Commencer",
    access: {
      granted: "Autorisée",
      refused: "Refusée",
      asked: "Demandée",
    } as Record<Exclude<Access, "unknown">, string>,
  },
  en: {
    headline: "Run, improve, and keep it all to yourself.",
    recordTitle: "Record your runs",
    recordDetail: "Distance, pace, elevation and track, even with the screen locked and your phone in your pocket.",
    planTitle: "Follow a training plan",
    planDetail: "From 5K to marathon: sessions built week by week, all the way to race day.",
    routesTitle: "Draw your routes",
    routesDetail: "Sketch a loop that follows the streets, then run it with the map in view.",
    note: "No account, no ads. Your runs stay on your phone.",
    continue: "Continue",
    twoPermissions: "Two permissions",
    onePermission: "One permission",
    permissionsLede:
      "You can say no: nothing will be asked behind your back, and you can change your mind in your phone's settings.",
    locationTitle: "Your location",
    locationDetail:
      "To measure your distance and draw your track. When you start a run, your phone will also offer to keep it with the screen off: say yes, or recording stops as soon as the phone is in your pocket.",
    openSettings: "Open Settings",
    allow: "Allow",
    healthTitle: "Apple Health",
    healthDetail:
      "To save your runs there, work out your calories from your weight, and show your heart rate if you run with a watch.",
    connect: "Connect",
    start: "Get started",
    access: {
      granted: "Allowed",
      refused: "Denied",
      asked: "Requested",
    },
  },
});

/**
 * The first thing the app shows, once.
 *
 * Two pages: what Tread does, then what it needs and why. Before this, the
 * first thing anybody saw was the Health sheet, raised by the app launching
 * with no word of explanation — the one moment a permission is least likely
 * to be granted — followed by an empty history.
 *
 * Nothing here is compulsory. Every permission can be refused and asked for
 * again later where it is used; the page only makes sure that the first time
 * the question comes up, the person being asked knows what it is for.
 */
export default function WelcomeScreen() {
  const [page, setPage] = useState<0 | 1>(0);

  return (
    <SafeAreaView style={styles.screen}>
      {page === 0 ? <Introduction onNext={() => setPage(1)} /> : <Permissions />}
    </SafeAreaView>
  );
}

function Introduction({ onNext }: { onNext: () => void }) {
  const s = useStrings(welcomeStrings);
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.brand}>Tread</Text>
        <Text style={styles.title}>{s.headline}</Text>

        <View style={styles.features}>
          <Feature
            icon="play"
            title={s.recordTitle}
            detail={s.recordDetail}
          />
          <Feature
            icon="calendar"
            title={s.planTitle}
            detail={s.planDetail}
          />
          <Feature
            icon="map"
            title={s.routesTitle}
            detail={s.routesDetail}
          />
        </View>

        <Text style={styles.note}>{s.note}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={s.continue} onPress={onNext} />
      </View>
    </View>
  );
}

function Feature({ icon, title, detail }: { icon: Icon; title: string; detail: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function Permissions() {
  const s = useStrings(welcomeStrings);
  const [location, setLocation] = useState<Access>("unknown");
  const [health, setHealth] = useState<Access>("unknown");
  const [canAskLocation, setCanAskLocation] = useState(true);
  const withHealth = healthAvailable();

  // A phone that already said yes, restored from a backup or reinstalled,
  // should not be asked a question it has answered.
  useEffect(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync()
      .then((existing) => {
        if (!active) return;
        setCanAskLocation(existing.canAskAgain);
        if (existing.status === "granted") setLocation("granted");
        else if (existing.status === "denied") setLocation("refused");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function askLocation() {
    if (!canAskLocation) {
      void Linking.openSettings();
      return;
    }
    try {
      const asked = await Location.requestForegroundPermissionsAsync();
      setCanAskLocation(asked.canAskAgain);
      setLocation(asked.status === "granted" ? "granted" : "refused");
    } catch {
      setLocation("refused");
    }
  }

  async function askHealth() {
    // Health never says whether reading was allowed, so the honest state
    // after asking is "asked", not "granted".
    await requestHealthAccess();
    setHealth("asked");
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{withHealth ? s.twoPermissions : s.onePermission}</Text>
        <Text style={styles.lede}>{s.permissionsLede}</Text>

        <Permission
          icon="navigate"
          title={s.locationTitle}
          detail={s.locationDetail}
          access={location}
          action={location === "refused" && !canAskLocation ? s.openSettings : s.allow}
          onPress={() => void askLocation()}
        />

        {withHealth ? (
          <Permission
            icon="heart"
            title={s.healthTitle}
            detail={s.healthDetail}
            access={health}
            action={s.connect}
            onPress={() => void askHealth()}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={s.start} onPress={() => void markWelcomed()} />
      </View>
    </View>
  );
}

function Permission({
  icon, title, detail, access, action, onPress,
}: {
  icon: Icon;
  title: string;
  detail: string;
  access: Access;
  action: string;
  onPress: () => void;
}) {
  const s = useStrings(welcomeStrings);
  const settled = access === "granted" || access === "asked";
  return (
    <View style={styles.permission}>
      <View style={styles.permissionHead}>
        <Ionicons name={icon} size={19} color={colors.accent} />
        <Text style={styles.permissionTitle}>{title}</Text>
        {access !== "unknown" ? (
          <Text style={[styles.status, access === "refused" && styles.statusRefused]}>
            {s.access[access]}
          </Text>
        ) : null}
      </View>
      <Text style={styles.permissionDetail}>{detail}</Text>
      {settled ? null : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
        >
          <Text style={styles.askLabel}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const GUTTER = 24;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: 36, paddingBottom: 24, gap: 14 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12 },

  brand: {
    color: colors.accent, fontSize: 17, fontFamily: font.bold,
    letterSpacing: 2.4, textTransform: "uppercase",
  },
  title: {
    color: colors.text, fontSize: 36, fontFamily: font.bold,
    letterSpacing: -0.8, lineHeight: 40,
  },
  lede: { color: colors.muted, fontSize: 16, fontFamily: font.regular, lineHeight: 23 },
  note: {
    color: colors.subtle, fontSize: 14.5, fontFamily: font.regular, lineHeight: 21, marginTop: 8,
  },

  features: { gap: 20, marginTop: 18 },
  feature: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  featureIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: colors.text, fontSize: 19, fontFamily: font.semibold, letterSpacing: -0.2 },
  featureDetail: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 21 },

  permission: {
    gap: 8, marginTop: 10, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  permissionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  permissionTitle: { flex: 1, color: colors.text, fontSize: 19, fontFamily: font.semibold },
  status: { color: colors.accent, fontSize: 14.5, fontFamily: font.semibold },
  statusRefused: { color: colors.subtle },
  permissionDetail: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 21 },
  ask: {
    alignSelf: "flex-start", marginTop: 4,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  askLabel: { color: colors.accent, fontSize: 15.5, fontFamily: font.semibold },
  pressed: { opacity: 0.6 },
});
