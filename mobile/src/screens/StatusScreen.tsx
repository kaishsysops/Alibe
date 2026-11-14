import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Globe, Server, Database, Mail, Wrench, ChevronLeft } from "lucide-react-native";
import { fetchSystemStatus, SystemStatus } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import AlibeMark from "../components/AlibeMark";
import Tap from "../components/Tap";
import { FadeIn } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, contentWidth } from "../theme/theme";

// alibe.online/status: is Alibe working right now? Open to everyone, signed in
// or not. Checks every 15 seconds and keeps the last 30 checks as a strip of
// bars, so a blip is visible after the fact.
const EVERY_MS = 15_000;
const HISTORY = 30;

type Check = { at: number; status: SystemStatus };
type Level = "ok" | "updating" | "degraded" | "down";

function levelOf(s?: SystemStatus): Level {
  if (!s) return "ok";
  if (!s.reachable) return "down";
  if (s.updating) return "updating";
  if (!s.database?.ok || !s.signInEmail?.ok) return "degraded";
  return "ok";
}

function duration(seconds?: number) {
  if (seconds === undefined) return "";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default function StatusScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [checks, setChecks] = useState<Check[]>([]);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const status = await fetchSystemStatus();
    setChecks((list) => [...list, { at: Date.now(), status }].slice(-HISTORY));
    setChecking(false);
    busy.current = false;
  }, []);

  useEffect(() => {
    check();
    const poll = setInterval(check, EVERY_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [check]);

  const latest = checks[checks.length - 1]?.status;
  const level = levelOf(latest);
  const tone = { ok: colors.success, updating: colors.gold, degraded: colors.gold, down: colors.danger }[level];
  const Banner = level === "ok" ? CheckCircle2 : level === "updating" ? Wrench : level === "degraded" ? AlertTriangle : XCircle;
  const headline = {
    ok: "All systems normal",
    updating: "Alibe is updating",
    degraded: "Some things aren't working",
    down: "Can't reach Alibe right now",
  }[level];
  const subline = {
    ok: "Everything below is working.",
    updating: "A new version is going live. This usually takes under a minute.",
    degraded: "We're on it. The parts below show what's affected.",
    down: "Either Alibe is down or your connection is. We'll keep checking.",
  }[level];
  const lastAt = checks[checks.length - 1]?.at;
  const ago = lastAt ? Math.max(0, Math.round((now - lastAt) / 1000)) : null;

  const rows: Array<{ Icon: typeof Globe; name: string; ok: boolean | undefined; detail: string }> = [
    { Icon: Globe, name: "Website", ok: true, detail: "Loaded" },
    { Icon: Server, name: "App server", ok: latest ? latest.reachable && !latest.updating : undefined, detail: latest?.updating ? "Restarting" : latest?.roundTripMs !== undefined ? `${latest.roundTripMs} ms` : latest && !latest.reachable ? "Not answering" : "" },
    { Icon: Database, name: "Database", ok: latest?.updating ? undefined : latest?.database?.ok, detail: latest?.database?.latencyMs != null ? `${latest.database.latencyMs} ms` : latest?.database ? "Not answering" : "" },
    { Icon: Mail, name: "Sign-in emails", ok: latest?.updating ? undefined : latest?.signInEmail?.ok, detail: latest?.signInEmail ? (latest.signInEmail.ok ? "Sending" : "Not set up") : "" },
  ];

  const body = (
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
      <FadeIn>
        <View style={[styles.banner, { backgroundColor: `${tone}18`, borderColor: `${tone}55` }]}>
          {checks.length === 0 ? <ActivityIndicator color={colors.primary} /> : <Banner size={30} color={tone} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.headline}>{checks.length === 0 ? "Checking..." : headline}</Text>
            {checks.length > 0 && <Text style={styles.subline}>{subline}</Text>}
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={styles.card}>
          {rows.map(({ Icon, name, ok, detail }, i) => (
            <View key={name} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Icon size={18} color={colors.textMuted} />
              <Text style={styles.rowName}>{name}</Text>
              <Text style={styles.rowDetail}>{detail}</Text>
              <View style={[styles.dot, { backgroundColor: ok === undefined ? colors.border : ok ? colors.success : colors.danger }]} />
            </View>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={160}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last {HISTORY} checks</Text>
          <View style={styles.bars}>
            {Array.from({ length: HISTORY }, (_, i) => {
              const c = checks[i - (HISTORY - checks.length)];
              const l = c ? levelOf(c.status) : null;
              const color = !l ? colors.border : l === "ok" ? colors.success : l === "down" ? colors.danger : colors.gold;
              // Taller bar = slower answer (capped), so slowdowns show too.
              const ms = c?.status.roundTripMs ?? 0;
              const h = !c ? 10 : Math.max(10, Math.min(34, 10 + ms / 25));
              return <View key={i} style={[styles.bar, { backgroundColor: color, height: h }]} />;
            })}
          </View>
          <Text style={styles.caption}>Every {EVERY_MS / 1000} seconds while this page is open. Taller bars are slower answers.</Text>
        </View>
      </FadeIn>

      <View style={styles.footer}>
        <Text style={styles.caption}>
          {latest?.version ? `Version ${latest.version}` : ""}
          {latest?.uptimeSeconds !== undefined ? ` · up ${duration(latest.uptimeSeconds)}` : ""}
          {ago !== null ? ` · checked ${ago}s ago` : ""}
        </Text>
        <Tap style={styles.again} onPress={check} disabled={checking} scaleTo={0.95}>
          {checking ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCw size={15} color={colors.primary} />}
          <Text style={styles.againText}>Check now</Text>
        </Tap>
      </View>
    </ScrollView>
  );

  // Signed in: the usual header with back. Signed out (someone opened the
  // link from outside): the logo and a way into Alibe.
  return (
    <View style={styles.container}>
      {user ? (
        <ScreenHeader title="Status" />
      ) : (
        <View style={[styles.publicTop, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.brand}>
            <AlibeMark size={26} color={colors.primary} />
            <Text style={styles.brandText}>Alibe status</Text>
          </View>
          <Tap style={styles.openApp} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] }))} scaleTo={0.95}>
            <ChevronLeft size={16} color={colors.primary} />
            <Text style={styles.againText}>Open Alibe</Text>
          </Tap>
        </View>
      )}
      {body}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  publicTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  openApp: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: spacing.sm + 4, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md + 2, borderRadius: radius.lg, borderWidth: 1 },
  headline: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  subline: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm + 4 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  rowDetail: { fontSize: fontSize.sm, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 36 },
  bar: { flex: 1, borderRadius: 2 },
  caption: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  footer: { alignItems: "center", gap: spacing.sm },
  again: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  againText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
