import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, LayoutChangeEvent, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { Search, X, Check, ChevronUp, ChevronDown, ChevronRight, MapPin, Globe2, Maximize2 } from "lucide-react-native";
import { Atoll, Island } from "../api/client";
import { ATOLL_GEO, ATOLL_ORDER, DEFAULT_ISLAND, ISLAND_GEO, POPULAR_ISLANDS } from "../data/maldives";
import MaldivesMap, { AtollDetailMap } from "./MaldivesMap";
import { Sheet } from "./Sheet";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight } from "../theme/theme";

// ---- helpers shared by every screen that asks "which island?" ----------------

// North to south, the way the country reads on the map.
export function sortAtolls(atolls: Atoll[]) {
  const rank = (a: Atoll) => (ATOLL_ORDER.indexOf(a.code) + 1 || 99);
  return [...atolls].sort((a, b) => rank(a) - rank(b));
}

export function findIsland(atolls: Atoll[], islandId?: string | null) {
  for (const atoll of atolls) {
    const island = atoll.islands.find((i) => i.id === islandId);
    if (island) return { atoll, island };
  }
  return null;
}

// Malé, unless it's missing from this server's data.
export function defaultIslandId(atolls: Atoll[]) {
  const [code, name] = DEFAULT_ISLAND;
  return atolls.find((a) => a.code === code)?.islands.find((i) => i.name === name)?.id ?? atolls[0]?.islands[0]?.id;
}

function pinFor(atoll: Atoll, island?: Island) {
  if (island) {
    const exact = ISLAND_GEO[`${atoll.code}/${island.name}`];
    if (exact) return exact;
  }
  const g = ATOLL_GEO[atoll.code];
  return g ? { lat: g.lat, lng: g.lng } : null;
}

export function islandLabel(atolls: Atoll[], islandId?: string | null) {
  const found = findIsland(atolls, islandId);
  return found ? { island: found.island.name, atoll: found.atoll.name } : null;
}

// ---- the picker ---------------------------------------------------------------

type IslandMode = { mode?: "island"; value?: string | null; onChange: (islandId: string) => void };
// Atoll mode (search filters): pick a whole atoll, or anywhere.
type AtollMode = { mode: "atoll"; value?: string | null; onChange: (atollId: string | undefined) => void };

type Props = (IslandMode | AtollMode) & { atolls: Atoll[]; mapHeight?: number };

export default function IslandPicker(props: Props) {
  const { atolls: unsorted, mapHeight = 380 } = props;
  const styles = useStyles();
  const { colors } = useTheme();
  const atolls = useMemo(() => sortAtolls(unsorted), [unsorted]);
  const atollMode = props.mode === "atoll";
  const [width, setWidth] = useState(0);
  const [query, setQuery] = useState("");

  const selectedIsland = atollMode ? null : findIsland(atolls, props.value);
  const selectedAtoll = atollMode ? atolls.find((a) => a.id === props.value) : selectedIsland?.atoll;
  // The atoll being looked at; follows the selection, and the map.
  const [viewCode, setViewCode] = useState<string | undefined>(selectedAtoll?.code ?? DEFAULT_ISLAND[0]);
  useEffect(() => {
    if (selectedAtoll) setViewCode(selectedAtoll.code);
  }, [selectedAtoll?.code]);
  const viewAtoll = atolls.find((a) => a.code === viewCode) ?? atolls[0];

  const pickIsland = (id: string) => !atollMode && (props as IslandMode).onChange(id);
  const pickAtoll = (a?: Atoll) => atollMode && (props as AtollMode).onChange(a?.id);

  const onMapSelect = (code: string) => {
    setViewCode(code);
    const atoll = atolls.find((a) => a.code === code);
    if (atollMode) pickAtoll(atoll);
    // A one-island atoll (Fuvahmulah): that's the answer.
    else if (atoll?.islands.length === 1) pickIsland(atoll.islands[0].id);
  };

  const step = (dir: 1 | -1) => {
    const i = atolls.findIndex((a) => a.code === viewAtoll?.code);
    const next = atolls[Math.min(atolls.length - 1, Math.max(0, i + dir))];
    if (next) onMapSelect(next.code);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const pq = plain(q);
    return atolls.flatMap((a) =>
      atollMode
        ? plain(a.name).includes(pq) ? [{ atoll: a, island: undefined as Island | undefined }] : []
        : a.islands.filter((i) => plain(i.name).includes(pq) || plain(a.name).includes(pq)).map((island) => ({ atoll: a, island }))
    ).slice(0, 30);
  }, [query, atolls, atollMode]);

  const popular = useMemo(
    () =>
      POPULAR_ISLANDS.flatMap(([code, name]) => {
        const atoll = atolls.find((a) => a.code === code);
        const island = atoll?.islands.find((i) => i.name === name);
        return atoll && island ? [{ atoll, island }] : [];
      }),
    [atolls]
  );

  // The whole country stays narrow; the chosen atoll up close gets the room.
  const mapWidth = Math.round(Math.min(150, Math.max(96, width * 0.3)));
  const detailHeight = Math.round(Math.min(230, mapHeight * 0.55));
  const pin = atollMode ? null : selectedIsland ? pinFor(selectedIsland.atoll, selectedIsland.island) : null;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.search}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={atollMode ? "Search atolls" : "Search islands, e.g. Hulhumalé"}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          accessibilityLabel={atollMode ? "Search atolls" : "Search islands"}
        />
        {!!query && (
          <Tap onPress={() => setQuery("")} hitSlop={10} scaleTo={0.85} accessibilityLabel="Clear search">
            <X size={16} color={colors.textMuted} />
          </Tap>
        )}
      </View>

      {query.trim() ? (
        <View style={styles.results}>
          {matches.length === 0 && <Text style={styles.empty}>No {atollMode ? "atoll" : "island"} called "{query.trim()}" yet.</Text>}
          {matches.map(({ atoll, island }) => {
            const on = island ? island.id === props.value : atoll.id === props.value;
            return (
              <Tap
                key={island?.id ?? atoll.id}
                style={[styles.result, on && styles.resultOn]}
                scaleTo={0.98}
                onPress={() => {
                  setViewCode(atoll.code);
                  if (island) pickIsland(island.id);
                  else pickAtoll(atoll);
                  setQuery("");
                }}
              >
                <MapPin size={16} color={on ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultTitle, on && { color: colors.primary }]}>{island?.name ?? atoll.name}</Text>
                  {island && <Text style={styles.resultMeta}>{atoll.name}</Text>}
                </View>
                {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
              </Tap>
            );
          })}
        </View>
      ) : (
        <>
          {!atollMode && popular.length > 0 && (
            <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popular} keyboardShouldPersistTaps="handled">
              {popular.map(({ atoll, island }) => {
                const on = island.id === props.value;
                return (
                  <Tap key={island.id} style={[styles.chip, on && styles.chipOn]} onPress={() => (setViewCode(atoll.code), pickIsland(island.id))} scaleTo={0.92}>
                    {on && <Check size={13} color={colors.inverseText} strokeWidth={3} />}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{island.name}</Text>
                  </Tap>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.atlas}>
            {width > 0 && (
              <MaldivesMap width={mapWidth} height={mapHeight} codes={atolls.map((a) => a.code)} selected={atollMode ? selectedAtoll?.code : viewAtoll?.code} pin={pin} onSelectAtoll={onMapSelect} />
            )}

            <View style={styles.side}>
              {atollMode ? (
                <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: mapHeight }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  <Tap style={[styles.atollRow, !props.value && styles.atollRowOn]} onPress={() => pickAtoll(undefined)} scaleTo={0.97}>
                    <Globe2 size={15} color={!props.value ? colors.primary : colors.textMuted} />
                    <Text style={[styles.atollRowText, !props.value && { color: colors.primary }]}>Anywhere</Text>
                  </Tap>
                  {atolls.map((a) => {
                    const on = a.id === props.value;
                    return (
                      <Tap key={a.id} style={[styles.atollRow, on && styles.atollRowOn]} onPress={() => onMapSelect(a.code)} scaleTo={0.97}>
                        <Text style={[styles.atollRowText, on && { color: colors.primary }]} numberOfLines={2}>
                          {a.name}
                        </Text>
                        {on && <Check size={14} color={colors.primary} strokeWidth={3} />}
                      </Tap>
                    );
                  })}
                </ScrollView>
              ) : (
                viewAtoll && (
                  <>
                    <View style={styles.stepper}>
                      <Tap style={styles.stepButton} onPress={() => step(-1)} scaleTo={0.88} accessibilityLabel="Atoll to the north">
                        <ChevronUp size={18} color={colors.text} />
                      </Tap>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.atollName} numberOfLines={2}>
                          {viewAtoll.name}
                        </Text>
                        <Text style={styles.atollMeta}>
                          {viewAtoll.islands.length} {viewAtoll.islands.length === 1 ? "island" : "islands"}
                        </Text>
                      </View>
                      <Tap style={styles.stepButton} onPress={() => step(1)} scaleTo={0.88} accessibilityLabel="Atoll to the south">
                        <ChevronDown size={18} color={colors.text} />
                      </Tap>
                    </View>
                    {/* The atoll up close: tap an island's dot to choose it. */}
                    <AtollDetailMap width={Math.max(140, width - mapWidth - spacing.md)} height={detailHeight} code={viewAtoll.code} islands={viewAtoll.islands} selectedId={props.value} onSelectIsland={pickIsland} />
                    <Text style={styles.orList}>or pick from the list</Text>
                    <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: Math.max(96, mapHeight - 64 - detailHeight - 28) }} contentContainerStyle={styles.islands} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      {viewAtoll.islands.map((i) => {
                        const on = i.id === props.value;
                        return (
                          <Tap key={i.id} style={[styles.island, on && styles.islandOn]} onPress={() => pickIsland(i.id)} scaleTo={0.95} accessibilityLabel={i.name}>
                            <Text style={[styles.islandText, on && styles.islandTextOn]} numberOfLines={1}>
                              {i.name}
                            </Text>
                            {on && <Check size={14} color={colors.inverseText} strokeWidth={3} />}
                          </Tap>
                        );
                      })}
                    </ScrollView>
                  </>
                )
              )}
            </View>
          </View>
          <Text style={styles.hint}>{atollMode ? "Tap or drag along the map to choose an atoll." : "Choose an atoll on the left, then tap your island on the close-up."}</Text>
        </>
      )}
    </View>
  );
}

// ---- compact atoll filter (Search) ---------------------------------------------
// For filter panels: no search box (the page has one) and no drag gestures
// (they'd fight the panel's scrolling). A small map shows the choice; the list
// does the choosing.

// Search filters: a small map beside the atoll list. Double-tap the map (or
// tap its expand button) to open it big and interactive: tap or drag along the
// chain to choose an atoll.
const DOUBLE_TAP_MS = 320;

export function AtollFilter({ atolls: unsorted, value, onChange }: { atolls: Atoll[]; value?: string | null; onChange: (atollId: string | undefined) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const atolls = useMemo(() => sortAtolls(unsorted), [unsorted]);
  const selected = atolls.find((a) => a.id === value);
  const g = selected ? ATOLL_GEO[selected.code] : undefined;
  const [big, setBig] = useState(false);
  const lastTap = useRef(0);
  const hint = useRef(new Animated.Value(0)).current;
  const onMapTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return setBig(true);
    }
    lastTap.current = now;
    // One tap: a quick nudge of the expand button says "there's more here".
    hint.setValue(0);
    Animated.sequence([Animated.timing(hint, { toValue: 1, duration: 140, useNativeDriver: true }), Animated.spring(hint, { toValue: 0, friction: 4, useNativeDriver: true })]).start();
  };
  const hintScale = hint.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  return (
    <View style={styles.filterWrap}>
      <Tap onPress={onMapTap} scaleTo={0.96} accessibilityLabel="Map of the Maldives. Double-tap to open it big" accessibilityHint="Opens a bigger map to choose an atoll">
        <MaldivesMap width={56} height={150} thumbnail codes={atolls.map((a) => a.code)} selected={selected?.code} pin={g ? { lat: g.lat, lng: g.lng } : null} />
        <Animated.View style={[styles.expandBadge, { transform: [{ scale: hintScale }] }]} pointerEvents="none">
          <Maximize2 size={12} color="#fff" strokeWidth={2.6} />
        </Animated.View>
      </Tap>
      <ScrollView showsHorizontalScrollIndicator={false} style={styles.filterList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {[{ id: undefined as string | undefined, label: "Anywhere" }, ...atolls.map((a) => ({ id: a.id as string | undefined, label: ATOLL_GEO[a.code]?.short ?? a.name }))].map((row) => {
          const on = row.id === (value ?? undefined);
          return (
            <Tap key={row.id ?? "any"} style={[styles.filterRow, on && styles.atollRowOn]} onPress={() => onChange(row.id)} scaleTo={0.98} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              {row.id ? null : <Globe2 size={14} color={on ? colors.primary : colors.textMuted} />}
              <Text style={[styles.atollRowText, on && { color: colors.primary }]} numberOfLines={1}>
                {row.label}
              </Text>
              {on && <Check size={14} color={colors.primary} strokeWidth={3} />}
            </Tap>
          );
        })}
      </ScrollView>
      <Sheet visible={big} onClose={() => setBig(false)} title="Where to look">
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: 680 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} keyboardShouldPersistTaps="handled">
          <Text style={styles.bigHint}>Tap an atoll on the map, or drag along it to look through them.</Text>
          <IslandPicker mode="atoll" atolls={atolls} value={value} onChange={onChange} mapHeight={460} />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", gap: spacing.sm }}>
          {!!value && (
            <Tap style={[styles.done, styles.anywhere]} onPress={() => onChange(undefined)} scaleTo={0.97}>
              <Text style={[styles.doneText, { color: colors.primary }]}>Anywhere</Text>
            </Tap>
          )}
          <Tap style={[styles.done, { flex: 1 }]} onPress={() => setBig(false)} scaleTo={0.97}>
            <Text style={styles.doneText}>{selected ? `Show ${ATOLL_GEO[selected.code]?.short ?? selected.name}` : "Done"}</Text>
          </Tap>
        </View>
      </Sheet>
    </View>
  );
}

// ---- in a sheet, behind a form field -------------------------------------------

export function IslandPickerSheet({ visible, onClose, title = "Choose your island", ...picker }: Props & { visible: boolean; onClose: () => void; title?: string }) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: 640 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} keyboardShouldPersistTaps="handled">
        <IslandPicker {...(picker as Props)} mapHeight={340} />
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Tap style={styles.done} onPress={onClose} scaleTo={0.97}>
          <Text style={styles.doneText}>Done</Text>
        </Tap>
      </View>
    </Sheet>
  );
}

// A form row showing the chosen island with a little map; opens the picker.
export function IslandField({ atolls, value, onChange, placeholder = "Choose an island" }: { atolls: Atoll[]; value?: string | null; onChange: (islandId: string) => void; placeholder?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const found = findIsland(atolls, value);
  const pin = found ? pinFor(found.atoll, found.island) : null;
  return (
    <>
      <Tap style={styles.field} onPress={() => setOpen(true)} scaleTo={0.98} accessibilityLabel={found ? `Island: ${found.island.name}. Change` : placeholder}>
        <MaldivesMap width={44} height={72} thumbnail codes={atolls.map((a) => a.code)} selected={found?.atoll.code} pin={pin} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.fieldTitle, !found && { color: colors.textMuted }]} numberOfLines={1}>
            {found?.island.name ?? placeholder}
          </Text>
          {found && (
            <Text style={styles.fieldMeta} numberOfLines={1}>
              {found.atoll.name}
            </Text>
          )}
        </View>
        <Text style={styles.fieldAction}>Change</Text>
        <ChevronRight size={16} color={colors.textMuted} />
      </Tap>
      <IslandPickerSheet visible={open} onClose={() => setOpen(false)} atolls={atolls} value={value} onChange={onChange} />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  results: { marginTop: spacing.sm, gap: 4 },
  result: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 4, borderRadius: radius.md },
  resultOn: { backgroundColor: colors.primaryTint },
  resultTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  resultMeta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  empty: { fontSize: fontSize.sm, color: colors.textMuted, paddingVertical: spacing.md, textAlign: "center" },
  popular: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextOn: { color: colors.inverseText },
  atlas: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  side: { flex: 1, minWidth: 0 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  stepButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  atollName: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  atollMeta: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: 1 },
  islands: { gap: 6 },
  island: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  islandOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  islandText: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  islandTextOn: { color: colors.inverseText, fontWeight: fontWeight.bold },
  atollRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 2, minHeight: 36, paddingVertical: 6, borderRadius: radius.md },
  atollRowOn: { backgroundColor: colors.primaryTint },
  atollRowText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  filterWrap: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  expandBadge: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card },
  bigHint: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  anywhere: { paddingHorizontal: spacing.lg, backgroundColor: colors.primaryTint },
  filterList: { flex: 1, maxHeight: 150, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 2, height: 34 },
  orList: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: 6 },
  done: { backgroundColor: colors.primary, borderRadius: radius.pill, height: controlHeight.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  doneText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm, paddingRight: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  fieldTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  fieldMeta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  fieldAction: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
