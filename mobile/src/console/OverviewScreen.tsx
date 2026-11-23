import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "../api/AuthContext";
import { useConsole } from "../components/ConsoleContext";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { SITE } from "../site";
import { visibleSections, accessLabel } from "./sections";

// The first page: a card per queue this person works on, with what's waiting.
export default function OverviewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { me } = useConsole();
  if (!me) return null;
  const sections = visibleSections(me, SITE).filter((s) => s.key !== "Overview");
  const queues = sections.filter((s) => s.count);
  const tools = sections.filter((s) => !s.count);
  const waiting = queues.reduce((n, s) => n + (me.counts[s.count!] ?? 0), 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hello}>
        {hello}, {user?.name?.split(" ")[0]}
      </Text>
      <Text style={styles.sub}>
        {accessLabel(me)} · {waiting ? `${waiting} ${waiting === 1 ? "thing needs" : "things need"} you` : "Nothing waiting right now"}
      </Text>

      {queues.length > 0 && (
        <View style={styles.grid}>
          {queues.map((s) => {
            const n = me.counts[s.count!] ?? 0;
            return (
              <Tap key={s.key} style={styles.card} onPress={() => navigation.navigate(s.key)} scaleTo={0.98} accessibilityLabel={`${s.title}: ${n} waiting`}>
                <View style={[styles.iconWrap, n > 0 && { backgroundColor: colors.primary }]}>
                  <s.Icon size={20} color={n > 0 ? "#fff" : colors.primary} />
                </View>
                <Text style={styles.number}>{n}</Text>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <View style={styles.cardFoot}>
                  {n > 0 ? (
                    <>
                      <Text style={styles.cardAction}>Review now</Text>
                      <ArrowRight size={15} color={colors.primary} />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} color={colors.success} />
                      <Text style={[styles.cardAction, { color: colors.success }]}>All caught up</Text>
                    </>
                  )}
                </View>
              </Tap>
            );
          })}
        </View>
      )}

      {tools.length > 0 && (
        <>
          <Text style={styles.section}>Tools</Text>
          <View style={styles.toolList}>
            {tools.map((s) => (
              <Tap key={s.key} style={styles.tool} onPress={() => navigation.navigate(s.key)} scaleTo={0.98}>
                <s.Icon size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toolTitle}>{s.title}</Text>
                  <Text style={styles.toolBlurb}>{s.blurb}</Text>
                </View>
                <ArrowRight size={16} color={colors.textMuted} />
              </Tap>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 1100 },
  hello: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  sub: { fontSize: fontSize.base, color: colors.textMuted, marginTop: -8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { flexGrow: 1, flexBasis: 220, maxWidth: 340, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: 6, ...cardShadow },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  number: { fontSize: 34, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -1 },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textMuted },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  cardAction: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  section: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.md },
  toolList: { backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, overflow: "hidden" },
  tool: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  toolTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  toolBlurb: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
}));
