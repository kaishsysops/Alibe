import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, LayoutChangeEvent } from "react-native";
import { Search, X, Check, ChevronUp, ChevronDown, ChevronRight, MapPin, Globe2 } from "lucide-react-native";
import { Atoll, Island } from "../api/client";
import { ATOLL_GEO, ATOLL_ORDER, DEFAULT_ISLAND, ISLAND_GEO, POPULAR_ISLANDS } from "../data/maldives";
import MaldivesMap from "./MaldivesMap";
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

  const mapWidth = Math.round(Math.min(190, Math.max(120, width * 0.42)));
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popular} keyboardShouldPersistTaps="handled">
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
                <ScrollView style={{ maxHeight: mapHeight }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  <Tap style={[styles.atollRow, !props.value && styles.atollRowOn]} onPress={() => pickAtoll(undefined)} scaleTo={0.97}>
                    <Globe2 size={15} color={!props.value ? colors.primary : colors.textMuted} />
                    <Text style={[styles.atollRowText, !props.value && { color: colors.primary }]}>Anywhere</Text>
                  </Tap>
                  {atolls.map((a) => {
                    const on = a.id === props.value;
                    return (
                      <Tap key={a.id} style={[styles.atollRow, on && styles.atollRowOn]} onPress={() => onMapSelect(a.code)} scaleTo={0.97}>
                        <Text style={[styles.atollRowText, on && { color: colors.primary }]} numberOfLines={1}>
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
                    <ScrollView style={{ maxHeight: mapHeight - 64 }} contentContainerStyle={styles.islands} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
          <Text style={styles.hint}>Tap the map or use the arrows to move between atolls.</Text>
        </>
      )}
    </View>
  );
}

// ---- in a sheet, behind a form field -------------------------------------------

export function IslandPickerSheet({ visible, onClose, title = "Choose your island", ...picker }: Props & { visible: boolean; onClose: () => void; title?: string }) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} keyboardShouldPersistTaps="handled">
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
  atollRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 2, height: 36, borderRadius: radius.md },
  atollRowOn: { backgroundColor: colors.primaryTint },
  atollRowText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  done: { backgroundColor: colors.primary, borderRadius: radius.pill, height: controlHeight.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  doneText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm, paddingRight: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  fieldTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  fieldMeta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  fieldAction: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
