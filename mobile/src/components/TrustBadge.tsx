import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ShieldAlert, ShieldCheck, Shield, Sparkles } from "lucide-react-native";
import { api, TrustLevel, TrustSummary } from "../api/client";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { Colors, spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { Skeleton } from "./Skeleton";

// One shared fetch per person per app session; trust changes slowly.
const cache = new Map<string, Promise<TrustSummary>>();
export function useTrust(userId: string | undefined) {
  const [trust, setTrust] = useState<TrustSummary | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    if (!cache.has(userId)) cache.set(userId, api.trust(userId).catch((e) => (cache.delete(userId), Promise.reject(e))));
    cache.get(userId)!.then((t) => alive && setTrust(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);
  return trust;
}

export function trustMeta(level: TrustLevel, colors: Colors) {
  switch (level) {
    case "TRUSTED":
      return { label: "Trusted seller", Icon: ShieldCheck, color: colors.success };
    case "ESTABLISHED":
      return { label: "Has delivered before", Icon: ShieldCheck, color: colors.verified };
    case "NEW":
      return { label: "New to Alibe", Icon: Sparkles, color: colors.gold };
    case "CAUTION":
      return { label: "Reported by others", Icon: ShieldAlert, color: colors.danger };
    default:
      return { label: "Alibe member", Icon: Shield, color: colors.textMuted };
  }
}

function memberFor(days: number) {
  if (days < 1) return "joined today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} on Alibe`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} on Alibe`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} on Alibe`;
}

function replyText(min: number) {
  if (min < 60) return "replies within an hour";
  if (min < 24 * 60) return "replies within a day";
  return "slow to reply";
}

// The facts behind the badge, in one short line a non-technical buyer can read.
export function trustFacts(t: TrustSummary) {
  const facts: string[] = [];
  facts.push(t.delivered ? `${t.delivered} deliver${t.delivered === 1 ? "y" : "ies"}` : "No deliveries yet");
  if (t.rating.count) facts.push(`${t.rating.average.toFixed(1)}★ (${t.rating.count})`);
  facts.push(memberFor(t.memberDays));
  if (t.replyMinutes !== null) facts.push(replyText(t.replyMinutes));
  return facts.join(" · ");
}

// Pill + optional facts line. `compact` shows the pill only.
export default function TrustBadge({ userId, compact, showFacts = true }: { userId: string; compact?: boolean; showFacts?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const trust = useTrust(userId);
  if (!trust) return <Skeleton width={compact ? 96 : 140} height={22} rounded={radius.pill} style={{ marginTop: 4 }} />;
  const meta = trustMeta(trust.level, colors);
  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: `${meta.color}1A` }]}>
        <meta.Icon size={13} color={meta.color} strokeWidth={2.4} />
        <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {!compact && showFacts && <Text style={styles.facts}>{trustFacts(trust)}</Text>}
      {!compact && trust.level === "NEW" && <Text style={[styles.facts, { color: colors.text }]}>New accounts can be genuine, but take extra care: meet in person or pay only at handover.</Text>}
      {!compact && trust.level === "CAUTION" && <Text style={[styles.facts, { color: colors.danger }]}>Several people reported this account recently. Be very careful.</Text>}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { marginTop: 4, alignItems: "flex-start" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, height: 24, borderRadius: radius.pill },
  pillText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  facts: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 4, lineHeight: fontSize.caption * 1.45 },
}));
