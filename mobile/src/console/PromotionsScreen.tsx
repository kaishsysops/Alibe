import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Megaphone, CalendarDays, BadgePercent, Sparkles, MessageSquareWarning, Plus, Trash2, Save } from "lucide-react-native";
import { api, Banner, Discount, errorMessage, Promotions, PromoKind, Season, SeasonTheme, SiteEvent, StaffNotice } from "../api/client";
import { useToast } from "../components/Toast";
import { useConsole } from "../components/ConsoleContext";
import PhotoSlot from "../components/PhotoSlot";
import { SEASON_LOOK } from "../components/Seasonal";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";
import { useConsolePage } from "./layout";

// Admin > Promotions: what runs across the site, all by date (inclusive,
// Maldives time). Saved together with one button. backend/src/promotions.ts.
type Tab = "BANNERS" | "EVENTS" | "DISCOUNTS" | "SEASON" | "STAFF";
const TABS: Array<[Tab, string, typeof Megaphone]> = [
  ["BANNERS", "Banners", Megaphone],
  ["EVENTS", "Events", CalendarDays],
  ["DISCOUNTS", "Discounts", BadgePercent],
  ["SEASON", "Season", Sparkles],
  ["STAFF", "Staff notices", MessageSquareWarning],
];
const KIND_NAME: Record<PromoKind, string> = { BOOST: "Boosts", AD: "Ads", STORE_PLAN: "Store plan", PREMIUM_PLAN: "Premium" };
const plusDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const newId = () => Math.random().toString(36).slice(2, 10);

export default function PromotionsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const page = useConsolePage();
  const { refresh } = useConsole();
  const [doc, setDoc] = useState<Promotions | null>(null);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<Tab>("BANNERS");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .adminPromotions()
      .then((r) => {
        setDoc(r.promotions);
        setToday(r.today);
        setDirty(false);
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [toast]);
  useEffect(load, [load]);

  const change = (patch: Partial<Promotions>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const save = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const r = await api.saveAdminPromotions(doc);
      setDoc(r.promotions);
      setDirty(false);
      toast.success("Saved. It shows on the site within a minute.");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!doc) return <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />;

  // ---- shared bits (render functions, so inputs keep focus) -----------------
  const state = (x: { startsOn: string; endsOn: string }) =>
    x.endsOn < today ? { label: "Ended", color: colors.textMuted } : x.startsOn > today ? { label: `Starts ${x.startsOn}`, color: colors.gold } : { label: "Running now", color: colors.success };
  // `row`: one of several side by side (they share the width and wrap).
  const field = (label: string, value: string, onChange: (v: string) => void, opts: { placeholder?: string; max?: number; multiline?: boolean; row?: boolean } = {}) => (
    <View style={[styles.field, opts.row && styles.fieldInRow]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, opts.multiline && { height: 72, paddingTop: 10, textAlignVertical: "top" }]} value={value} onChangeText={onChange} placeholder={opts.placeholder} placeholderTextColor={colors.textMuted} maxLength={opts.max} multiline={opts.multiline} />
    </View>
  );
  const dateRange = <T extends { startsOn: string; endsOn: string }>(x: T, set: (patch: Partial<T>) => void) => (
    <View style={styles.dates}>
      {field("Starts", x.startsOn, (v) => set({ startsOn: v } as Partial<T>), { placeholder: "2026-03-01", max: 10, row: true })}
      {field("Ends (last day)", x.endsOn, (v) => set({ endsOn: v } as Partial<T>), { placeholder: "2026-03-30", max: 10, row: true })}
    </View>
  );
  const choice = <V extends string>(options: Array<[V, string]>, value: V, onChange: (v: V) => void) => (
    <View style={styles.chips}>
      {options.map(([v, l]) => (
        <Tap key={v} style={[styles.chip, value === v && styles.chipOn]} onPress={() => onChange(v)} scaleTo={0.95}>
          <Text style={[styles.chipText, value === v && styles.chipTextOn]}>{l}</Text>
        </Tap>
      ))}
    </View>
  );
  const itemHead = (x: { startsOn: string; endsOn: string }, title: string, onRemove: () => void) => {
    const st = state(x);
    return (
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.state, { backgroundColor: `${st.color}1A` }]}>
          <Text style={[styles.stateText, { color: st.color }]}>{st.label}</Text>
        </View>
        <Tap onPress={onRemove} hitSlop={8} scaleTo={0.9} accessibilityLabel="Remove">
          <Trash2 size={17} color={colors.danger} />
        </Tap>
      </View>
    );
  };
  function listEditor<T extends { id: string; startsOn: string; endsOn: string }>(items: T[], key: keyof Promotions, title: (x: T) => string, body: (x: T, set: (p: Partial<T>) => void) => React.ReactNode, fresh: () => T, addLabel: string) {
    const setItem = (id: string, p: Partial<T>) => change({ [key]: items.map((x) => (x.id === id ? { ...x, ...p } : x)) } as Partial<Promotions>);
    return (
      <View style={{ gap: spacing.md }}>
        {items.length === 0 && <Text style={styles.empty}>Nothing yet.</Text>}
        {items.map((x) => (
          <View key={x.id} style={styles.item}>
            {itemHead(x, title(x), () => change({ [key]: items.filter((y) => y.id !== x.id) } as Partial<Promotions>))}
            {body(x, (p) => setItem(x.id, p))}
            {dateRange(x, (p) => setItem(x.id, p))}
          </View>
        ))}
        <Tap style={styles.add} onPress={() => change({ [key]: [...items, fresh()] } as Partial<Promotions>)} scaleTo={0.97}>
          <Plus size={17} color={colors.primary} />
          <Text style={styles.addText}>{addLabel}</Text>
        </Tap>
      </View>
    );
  }
  const week = { startsOn: today, endsOn: plusDays(today, 6) };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scroll, page]} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {TABS.map(([key, label, Icon]) => {
            const on = tab === key;
            return (
              <Tap key={key} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(key)} scaleTo={0.96}>
                <Icon size={15} color={on ? colors.inverseText : colors.textMuted} />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Tap>
            );
          })}
        </View>

        {tab === "BANNERS" && (
          <>
            <Text style={styles.help}>A message strip at the top of the app. "Everyone" shows on Home and seller screens; "Buyers" on Home; "Sellers" on Sell, My listings and Seller account. People can close it.</Text>
            {listEditor<Banner>(
              doc.banners,
              "banners",
              (b) => b.message || "New banner",
              (b, set) => (
                <>
                  {field("Message", b.message, (message) => set({ message }), { placeholder: "Ferries are delayed this week: allow extra time for deliveries.", max: 140, multiline: true })}
                  {choice<Banner["tone"]>([["INFO", "Info"], ["SUCCESS", "Good news"], ["WARNING", "Warning"], ["CELEBRATE", "Celebrate"]], b.tone, (tone) => set({ tone }))}
                  {choice<Banner["audience"]>([["EVERYONE", "Everyone"], ["BUYERS", "Buyers"], ["SELLERS", "Sellers"]], b.audience, (audience) => set({ audience }))}
                  <View style={styles.dates}>
                    {field("Link text (optional)", b.linkLabel ?? "", (linkLabel) => set({ linkLabel: linkLabel || undefined }), { placeholder: "Learn more", max: 30, row: true })}
                    {field("Link (optional)", b.link ?? "", (link) => set({ link: link || undefined }), { placeholder: "/help/safety or https://…", max: 300, row: true })}
                  </View>
                </>
              ),
              () => ({ id: newId(), ...week, message: "", tone: "INFO", audience: "EVERYONE" }),
              "Add a banner"
            )}
          </>
        )}

        {tab === "EVENTS" && (
          <>
            <Text style={styles.help}>A campaign card on Home. "Shop now" opens Browse with the search and/or category you set.</Text>
            {listEditor<SiteEvent>(
              doc.events,
              "events",
              (e) => e.title || "New event",
              (e, set) => (
                <>
                  <View style={styles.dates}>
                    <View style={{ width: 140 }}>
                      <PhotoSlot label="Picture (optional)" value={e.image ?? null} onChange={(image) => set({ image })} square style={{ flexGrow: 0, flexBasis: "auto", minWidth: 0 }} />
                    </View>
                    <View style={{ flexGrow: 1, flexBasis: 260, gap: spacing.sm }}>
                      {field("Title", e.title, (title) => set({ title }), { placeholder: "Eid Sale", max: 60 })}
                      {field("Subtitle (optional)", e.subtitle ?? "", (subtitle) => set({ subtitle: subtitle || undefined }), { placeholder: "Gifts and new clothes from shops across the Maldives", max: 140 })}
                    </View>
                  </View>
                  <View style={styles.dates}>
                    {field("Search for (optional)", e.searchText ?? "", (searchText) => set({ searchText: searchText || undefined }), { placeholder: "eid", max: 60, row: true })}
                    {field("Category slug (optional)", e.categorySlug ?? "", (categorySlug) => set({ categorySlug: categorySlug || undefined }), { placeholder: "fashion", max: 60, row: true })}
                  </View>
                </>
              ),
              () => ({ id: newId(), ...week, title: "" }),
              "Add an event"
            )}
          </>
        )}

        {tab === "DISCOUNTS" && (
          <>
            <Text style={styles.help}>Money off boosts, ads and plans while it runs. Buyers see the old price crossed out; the lower price is what's charged. If two overlap, the bigger one wins.</Text>
            {listEditor<Discount>(
              doc.discounts,
              "discounts",
              (d) => (d.label ? `${d.label} · ${d.percent}% off` : "New discount"),
              (d, set) => (
                <>
                  <View style={styles.dates}>
                    {field("Name buyers see", d.label, (label) => set({ label }), { placeholder: "Eid offer", max: 40, row: true })}
                    {field("Percent off", String(d.percent || ""), (v) => set({ percent: Math.min(90, Number(v.replace(/\D/g, "")) || 0) }), { placeholder: "20", max: 2, row: true })}
                  </View>
                  <Text style={styles.label}>Applies to</Text>
                  <View style={styles.chips}>
                    {(Object.keys(KIND_NAME) as PromoKind[]).map((k) => {
                      const on = d.appliesTo.includes(k);
                      return (
                        <Tap key={k} style={[styles.chip, on && styles.chipOn]} onPress={() => set({ appliesTo: on ? d.appliesTo.filter((x) => x !== k) : [...d.appliesTo, k] })} scaleTo={0.95}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{KIND_NAME[k]}</Text>
                        </Tap>
                      );
                    })}
                  </View>
                </>
              ),
              () => ({ id: newId(), ...week, label: "", percent: 20, appliesTo: ["BOOST", "AD"] }),
              "Add a discount"
            )}
          </>
        )}

        {tab === "SEASON" && (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.help}>A seasonal mark beside the Alibe logo and a greeting on Home, for the dates you set. One at a time.</Text>
            <View style={styles.seasonGrid}>
              {(Object.keys(SEASON_LOOK) as SeasonTheme[]).map((t) => {
                const look = SEASON_LOOK[t];
                const on = doc.season?.theme === t;
                return (
                  <Tap key={t} style={[styles.seasonCard, on && { borderColor: look.color, backgroundColor: `${look.color}12` }]} onPress={() => change({ season: { theme: t, startsOn: doc.season?.startsOn ?? today, endsOn: doc.season?.endsOn ?? plusDays(today, 29), greeting: doc.season?.theme === t ? doc.season.greeting : undefined } })} scaleTo={0.97}>
                    <View style={[styles.seasonIcon, { backgroundColor: `${look.color}22` }]}>
                      <look.Icon size={22} color={look.color} fill={t === "RAMADAN" || t === "EID" ? look.color : "transparent"} />
                    </View>
                    <Text style={styles.itemTitle}>{look.name}</Text>
                    <Text style={styles.help}>{look.greeting}</Text>
                  </Tap>
                );
              })}
            </View>
            {doc.season ? (
              <View style={styles.item}>
                {itemHead(doc.season, SEASON_LOOK[doc.season.theme].name, () => change({ season: null }))}
                {field("Greeting (optional)", doc.season.greeting ?? "", (greeting) => change({ season: { ...(doc.season as Season), greeting: greeting || undefined } }), { placeholder: SEASON_LOOK[doc.season.theme].greeting, max: 40 })}
                {dateRange(doc.season, (p) => change({ season: { ...(doc.season as Season), ...p } }))}
              </View>
            ) : (
              <Text style={styles.empty}>No season on. Pick one above.</Text>
            )}
          </View>
        )}

        {tab === "STAFF" && (
          <>
            <Text style={styles.help}>Shown at the top of the staff portal and admin home, for everyone with staff access.</Text>
            {listEditor<StaffNotice>(
              doc.staffNotices,
              "staffNotices",
              (n) => n.message || "New notice",
              (n, set) => (
                <>
                  {field("Message", n.message, (message) => set({ message }), { placeholder: "Busy week: please check the post queue twice a day.", max: 300, multiline: true })}
                  {choice<StaffNotice["tone"]>([["INFO", "Info"], ["WARNING", "Important"]], n.tone, (tone) => set({ tone }))}
                </>
              ),
              () => ({ id: newId(), ...week, message: "", tone: "INFO" }),
              "Add a notice"
            )}
          </>
        )}
      </ScrollView>

      {dirty && (
        <View style={styles.saveBar}>
          <Text style={styles.saveHint}>You have unsaved changes</Text>
          <Tap style={styles.saveButton} onPress={save} disabled={saving} scaleTo={0.97}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={16} color="#fff" />
                <Text style={styles.saveText}>Save</Text>
              </>
            )}
          </Tap>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { paddingVertical: spacing.lg, paddingBottom: 120, gap: spacing.md },
  tabs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: "center", maxWidth: "100%" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.md },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  tabTextOn: { color: colors.inverseText },
  help: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 19 },
  empty: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  item: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 2, gap: spacing.sm + 2, ...cardShadow },
  itemHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  state: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: "center" },
  stateText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold },
  field: { gap: 6 },
  fieldInRow: { flexGrow: 1, flexBasis: 200 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  input: { height: controlHeight.input - 6, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.text, outlineStyle: "none" as any },
  dates: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, height: 32, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.text },
  chipTextOn: { color: colors.inverseText },
  add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addText: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.primary },
  seasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  seasonCard: { flexGrow: 1, flexBasis: 160, padding: spacing.md, gap: 4, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  seasonIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  saveBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  saveHint: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  saveButton: { flexDirection: "row", gap: spacing.sm, minWidth: 140, height: 44, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  saveText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.base },
}));
