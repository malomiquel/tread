import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { API_URL, authClient, lastSync, syncNow, type SyncOutcome } from "@/lib/account";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import { colors, font } from "@/lib/theme";

const MIN_PASSWORD = 10;

const accountStrings = defineStrings({
  fr: {
    lede: "Le même compte que sur le web : tes sorties, ton programme et tes parcours s'y retrouvent sur grand écran. L'app marche sans, et tout reste aussi sur ce téléphone.",
    signIn: "Se connecter",
    signUp: "Créer un compte",
    name: "Prénom",
    email: "Adresse e-mail",
    password: "Mot de passe",
    passwordHint: "Au moins 10 caractères.",
    forgot: "Mot de passe oublié",
    working: "Un instant…",
    failedTitle: "Connexion impossible",
    wrong: "Adresse ou mot de passe incorrect.",
    taken: "Impossible de créer un compte avec cette adresse. Essaie de te connecter.",
    tooShort: "Le mot de passe doit faire au moins 10 caractères.",
    tooMany: "Trop d'essais d'un coup. Attends une minute.",
    offline: "Le serveur ne répond pas. Vérifie ta connexion et réessaie.",
    account: "Compte",
    sync: "Envoyer maintenant",
    syncFooter: "L'envoi se fait tout seul après chaque course et quand tu quittes l'app, si quelque chose a changé.",
    never: "Jamais",
    web: "Voir sur le web",
    signOut: "Se déconnecter",
    synced: "Envoyé",
    syncDone: (added: number, updated: number) =>
      [added > 0 ? `${added} sortie${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}` : null,
        updated > 0 ? `${updated} à jour` : null].filter(Boolean).join(" · ") || "Rien de nouveau.",
    syncFailed: "L'envoi n'a pas abouti. Rien n'est perdu : tout est encore sur ce téléphone.",
  },
  en: {
    lede: "The same account as on the web: your outings, plan and routes meet there on a large screen. The app works without it, and everything stays on this phone too.",
    signIn: "Sign in",
    signUp: "Create an account",
    name: "First name",
    email: "Email address",
    password: "Password",
    passwordHint: "At least 10 characters.",
    forgot: "Forgot password",
    working: "One moment…",
    failedTitle: "Cannot sign in",
    wrong: "Wrong address or password.",
    taken: "This address cannot be used for a new account. Try signing in.",
    tooShort: "The password needs at least 10 characters.",
    tooMany: "Too many tries at once. Wait a minute.",
    offline: "The server does not answer. Check your connection and try again.",
    account: "Account",
    sync: "Send now",
    syncFooter: "Sending happens by itself after every run and when you leave the app, if anything changed.",
    never: "Never",
    web: "See it on the web",
    signOut: "Sign out",
    synced: "Sent",
    syncDone: (added: number, updated: number) =>
      [added > 0 ? `${added} outing${added === 1 ? "" : "s"} added` : null,
        updated > 0 ? `${updated} up to date` : null].filter(Boolean).join(" · ") || "Nothing new.",
    syncFailed: "Sending did not go through. Nothing is lost: everything is still on this phone.",
  },
});

type Mode = "signIn" | "signUp";

/**
 * The Tread account, on the phone.
 *
 * Signed out: one form for both doors, a sign-in by default. Signed in: the
 * address, when this phone last sent its history, a way to send it now, and
 * the way out. Forgetting a password is done on the web, where the e-mail's
 * link leads.
 */
export default function AccountScreen() {
  const s = useStrings(accountStrings);
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    void lastSync().then((state) => setSyncedAt(state?.at ?? null));
  }, []));

  const report = (outcome: SyncOutcome) => {
    if (outcome.kind === "done") Alert.alert(s.synced, s.syncDone(outcome.result.added, outcome.result.updated));
    else if (outcome.kind === "failed") Alert.alert(s.synced, s.syncFailed);
  };

  async function submit() {
    // The keyboard's return key reaches here even while the button is greyed out.
    if (busy || !email.trim() || !password) return;
    if (password.length < MIN_PASSWORD) {
      Alert.alert(s.failedTitle, s.tooShort);
      return;
    }
    setBusy(true);
    try {
      const address = email.trim();
      const { error } = mode === "signUp"
        ? await authClient.signUp.email({ name: name.trim() || address.split("@")[0], email: address, password })
        : await authClient.signIn.email({ email: address, password });
      if (error) {
        Alert.alert(s.failedTitle, error.status === 429 ? s.tooMany : mode === "signUp" ? s.taken : s.wrong);
        return;
      }
      setPassword("");
      await refetch();
      // The first send, straight away: that is what signing in was for.
      setSyncing(true);
      const outcome = await syncNow(true);
      setSyncing(false);
      void lastSync().then((state) => setSyncedAt(state?.at ?? null));
      report(outcome);
    } catch {
      Alert.alert(s.failedTitle, s.offline);
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setSyncing(true);
    const outcome = await syncNow(true);
    setSyncing(false);
    setSyncedAt((await lastSync())?.at ?? null);
    report(outcome);
  }

  if (isPending) {
    return <View style={[styles.screen, styles.centre]}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (session) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.lede}>{s.lede}</Text>
        <SettingsGroup title={s.account} footer={s.syncFooter}>
          <SettingRow icon="person-circle-outline" label={session.user.name} value={session.user.email} />
          <SettingRow
            icon="cloud-upload-outline"
            label={s.sync}
            value={syncedAt
              ? new Date(syncedAt).toLocaleString(intlLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : s.never}
            right={syncing ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
            onPress={syncing ? undefined : () => void sendNow()}
          />
          <SettingRow icon="globe-outline" label={s.web} onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/history`)} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingRow label={s.signOut} destructive onPress={() => void authClient.signOut().then(() => refetch())} />
        </SettingsGroup>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lede}>{s.lede}</Text>
      <View style={styles.switcher}>
        <Segmented
          options={[{ value: "signIn", label: s.signIn }, { value: "signUp", label: s.signUp }]}
          value={mode}
          onChange={setMode}
        />
      </View>
      {mode === "signUp" ? (
        <SettingsGroup title={s.name}>
          <TextInput value={name} onChangeText={setName} style={styles.input} autoComplete="given-name"
            textContentType="givenName" accessibilityLabel={s.name} placeholderTextColor={colors.subtle} />
        </SettingsGroup>
      ) : null}
      <SettingsGroup title={s.email}>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel={s.email} />
      </SettingsGroup>
      <SettingsGroup title={s.password} footer={mode === "signUp" ? s.passwordHint : undefined}>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          textContentType={mode === "signUp" ? "newPassword" : "password"} accessibilityLabel={s.password}
          returnKeyType="go" onSubmitEditing={() => void submit()} />
      </SettingsGroup>
      <View style={styles.actions}>
        <Button
          label={busy ? s.working : mode === "signUp" ? s.signUp : s.signIn}
          onPress={() => void submit()}
          disabled={busy || !email.trim() || !password}
        />
        {mode === "signIn" ? (
          <Button label={s.forgot} variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centre: { alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 48 },
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
  switcher: { paddingHorizontal: GUTTER, paddingTop: 18 },
  input: { color: colors.text, fontSize: 17, fontFamily: font.semibold, paddingVertical: 13 },
  actions: { marginTop: 24, paddingHorizontal: 16, gap: 10 },
});
