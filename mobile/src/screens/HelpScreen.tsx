import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search, ChevronDown, ChevronLeft, X, LifeBuoy } from "lucide-react-native";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import { FadeIn } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { FAQ, HELP_TOPICS, HelpTopicKey } from "../help/topics";

// alibe.online/help: how Alibe works, by topic, with search. Other screens
// link straight to a topic: navigation.navigate("Help", { topic: "selling" }).
export default function HelpScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const [topicKey, setTopicKey] = useState<HelpTopicKey | null>(route.params?.topic ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const topic = HELP_TOPICS.find((t) => t.key === topicKey) ?? null;
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q.length < 2
        ? []
        : HELP_TOPICS.filter((t) => t.key !== "faq").flatMap((t) => t.items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(q)).map((i) => ({ ...i, topic: t }))),
    [q]
  );

  const qa = (item: { q: string; a: string }, key: string, i: number) => {
    const isOpen = open === key;
    return (
      <FadeIn key={key} delay={Math.min(i, 8) * 25}>
        <Tap style={[styles.qa, isOpen && styles.qaOpen]} onPress={() => setOpen(isOpen ? null : key)} scaleTo={0.99} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
          <View style={styles.qaHead}>
            <Text style={styles.question}>{item.q}</Text>
            <ChevronDown size={18} color={colors.textMuted} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
          </View>
          {isOpen && <Text style={styles.answer}>{item.a}</Text>}
        </Tap>
      </FadeIn>
    );
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="help" /> : <ScreenHeader title={topic ? topic.title : "Help"} />}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!topic && (
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <LifeBuoy size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>How can we help?</Text>
            <Text style={styles.lead}>Everything about buying, selling and staying safe on Alibe.</Text>
          </View>
        )}

        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search help, e.g. boost, verify, refund" placeholderTextColor={colors.textMuted} accessibilityLabel="Search help" returnKeyType="search" />
          {!!query && (
            <Tap onPress={() => setQuery("")} hitSlop={8} scaleTo={0.9} accessibilityLabel="Clear search">
              <X size={16} color={colors.textMuted} />
            </Tap>
          )}
        </View>

        {q.length >= 2 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>{results.length ? `${results.length} ${results.length === 1 ? "answer" : "answers"}` : "No answers found"}</Text>
            {results.map((r, i) => (
              <View key={r.q} style={{ gap: 4 }}>
                <Text style={styles.resultTopic}>{r.topic.title}</Text>
                {qa(r, `s-${r.q}`, i)}
              </View>
            ))}
            {!results.length && <Text style={styles.muted}>Try other words, or email help@alibe.online.</Text>}
          </View>
        ) : topic ? (
          <View style={{ gap: spacing.sm }}>
            <Tap style={styles.back} onPress={() => (setTopicKey(null), setOpen(null))} scaleTo={0.96}>
              <ChevronLeft size={16} color={colors.primary} />
              <Text style={styles.backText}>All topics</Text>
            </Tap>
            <View style={styles.topicHead}>
              <View style={styles.topicIcon}>
                <topic.Icon size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.muted}>{topic.blurb}</Text>
              </View>
            </View>
            {topic.items.map((item, i) => qa(item, `${topic.key}-${i}`, i))}
          </View>
        ) : (
          <>
          <View style={{ gap: spacing.sm }}>
            <View style={styles.faqHead}>
              <Text style={styles.sectionTitle}>Frequently asked</Text>
              <Tap onPress={() => (setTopicKey("faq"), setOpen(null))} scaleTo={0.96}>
                <Text style={styles.link}>See all {FAQ.length}</Text>
              </Tap>
            </View>
            {FAQ.slice(0, 6).map((item, i) => qa(item, `faq-${i}`, i))}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Browse by topic</Text>
          <View style={styles.grid}>
            {HELP_TOPICS.filter((t) => t.key !== "faq").map((t, i) => (
              <FadeIn key={t.key} delay={Math.min(i, 10) * 30} style={styles.cell}>
                <Tap style={styles.tile} onPress={() => (setTopicKey(t.key), setOpen(null))} scaleTo={0.97} accessibilityLabel={`${t.title}: ${t.blurb}`}>
                  <View style={styles.tileIcon}>
                    <t.Icon size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.tileTitle}>{t.title}</Text>
                  <Text style={styles.tileBlurb}>{t.blurb}</Text>
                </Tap>
              </FadeIn>
            ))}
          </View>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.muted}>Still stuck? Email help@alibe.online</Text>
          <Tap onPress={() => navigation.navigate("Safety")} scaleTo={0.97}>
            <Text style={styles.link}>How Alibe keeps you safe</Text>
          </Tap>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.lg, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  hero: { alignItems: "center", gap: 4, marginBottom: spacing.xs },
  heroIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  lead: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  section: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  resultTopic: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary, marginTop: spacing.xs },
  faqHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  cell: { flexGrow: 1, flexBasis: 150, alignSelf: "stretch" },
  tile: { flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: 4, minHeight: 116, ...cardShadow },
  tileIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tileTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  tileBlurb: { fontSize: fontSize.caption, color: colors.textMuted },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  topicHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, marginBottom: spacing.xs },
  topicIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  topicTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  qa: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  qaOpen: { borderWidth: 1.5, borderColor: colors.primaryTint },
  qaHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  question: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  answer: { fontSize: fontSize.base, color: colors.text, lineHeight: 22, marginTop: spacing.sm },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  footer: { alignItems: "center", gap: 6, marginTop: spacing.md },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
