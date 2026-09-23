import { ScrollView, StyleSheet, Text, View } from "react-native";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

const privacyStrings = defineStrings({
  fr: {
    onPhoneTitle: "Sur ton téléphone",
    onPhone:
      "Tes courses, leurs tracés GPS, tes parcours, ton programme et tes réglages sont enregistrés sur ce téléphone, et nulle part ailleurs. Tread n'a ni compte, ni serveur, ni publicité, ni outil de mesure d'audience : personne, pas même l'éditeur de l'app, ne voit tes données.",
    leavesTitle: "Ce qui en sort, et pourquoi",
    leaves: "Seules quelques questions partent sur internet, sans jamais ton nom ni ton historique :",
    weatherTitle: "La météo",
    weather:
      "Ta position, arrondie à environ un kilomètre, est envoyée à Open-Meteo pour connaître le temps au départ, à l'arrivée et les jours de tes prochaines séances.",
    routingTitle: "Le tracé des parcours",
    routing:
      "Quand tu dessines un parcours, les points que tu poses sont envoyés au service d'itinéraires OSRM (routing.openstreetmap.de) pour trouver le chemin entre eux.",
    mapsTitle: "Les cartes et les noms de lieux",
    maps:
      "La carte et le nom de la ville sous un parcours viennent du service de cartes du téléphone (Plans sur iPhone, Google sur Android), qui voit la zone affichée.",
    healthTitle: "Apple Santé",
    health:
      "Si tu l'autorises, Tread y copie tes courses et y lit ton poids, ta fréquence cardiaque et ta date de naissance, pour les calories et les zones cardiaques. Ces données restent dans Santé, sur ton téléphone.",
    sharingTitle: "Quand c'est toi qui partages",
    sharing:
      "Une image, un fichier GPX ou un transfert vers un nouveau téléphone ne partent que lorsque tu le demandes, et seulement vers l'endroit que tu choisis. Le transfert par WiFi va directement d'un téléphone à l'autre, sans passer par internet.",
    eraseTitle: "Effacer",
    erase:
      "Supprimer une course l'efface pour de bon, y compris sa copie dans Santé. Supprimer un parcours efface son tracé et son image. Supprimer l'app efface tout le reste.",
  },
  en: {
    onPhoneTitle: "On your phone",
    onPhone:
      "Your runs, their GPS tracks, your routes, your training plan and your settings are stored on this phone, and nowhere else. Tread has no account, no server, no ads and no analytics: nobody, not even the app's developer, can see your data.",
    leavesTitle: "What leaves it, and why",
    leaves: "Only a few questions go out to the internet, never with your name or your history:",
    weatherTitle: "Weather",
    weather:
      "Your location, rounded to about a kilometre, is sent to Open-Meteo to get the weather at the start and finish of a run, and on the days of your upcoming sessions.",
    routingTitle: "Drawing routes",
    routing:
      "When you draw a route, the points you place are sent to the OSRM routing service (routing.openstreetmap.de) to find the way between them.",
    mapsTitle: "Maps and place names",
    maps:
      "The map and the town name under a route come from your phone's map service (Apple Maps on iPhone, Google on Android), which sees the area shown.",
    healthTitle: "Apple Health",
    health:
      "If you allow it, Tread saves your runs there and reads your weight, heart rate and date of birth, for calories and heart rate zones. This data stays in Health, on your phone.",
    sharingTitle: "When you share",
    sharing:
      "A picture, a GPX file or a transfer to a new phone only goes out when you ask, and only to the place you choose. The WiFi transfer goes straight from one phone to the other, without going through the internet.",
    eraseTitle: "Deleting",
    erase:
      "Deleting a run erases it for good, including its copy in Health. Deleting a route erases its track and its picture. Deleting the app erases everything else.",
  },
});

/**
 * What stays on the phone and what leaves it, in plain words.
 *
 * Written from what the code actually does, and to be kept that way: every
 * request the app makes to anybody is listed here, with what it carries. A
 * new one that is not on this page is a promise broken.
 */
export default function PrivacyScreen() {
  const s = useStrings(privacyStrings);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title={s.onPhoneTitle}>{s.onPhone}</Section>

      <Section title={s.leavesTitle}>{s.leaves}</Section>
      <Item title={s.weatherTitle}>{s.weather}</Item>
      <Item title={s.routingTitle}>{s.routing}</Item>
      <Item title={s.mapsTitle}>{s.maps}</Item>

      <Section title={s.healthTitle}>{s.health}</Section>

      <Section title={s.sharingTitle}>{s.sharing}</Section>

      <Section title={s.eraseTitle}>{s.erase}</Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: GUTTER, paddingBottom: 40 },
  section: { gap: 6, marginTop: 22 },
  title: { color: colors.text, fontSize: 20, fontFamily: font.bold, letterSpacing: -0.3 },
  body: { color: colors.muted, fontSize: 15.5, fontFamily: font.regular, lineHeight: 22 },
  item: {
    gap: 3, marginTop: 12, paddingLeft: 12,
    borderLeftWidth: 2, borderLeftColor: colors.accentSoft,
  },
  itemTitle: { color: colors.text, fontSize: 16.5, fontFamily: font.semibold },
});
