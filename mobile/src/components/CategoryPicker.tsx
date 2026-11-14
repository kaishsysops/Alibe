import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight, Sparkles, Check, Pencil } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { api, AttributeDef, Category, CategorySuggestion, ListingAttributes } from "../api/client";
import { buildCategoryTree, CategoryTree } from "../utils/categoryTree";
import { categoryLook } from "../theme/categoryIcons";
import { FadeIn, Pop } from "./Motion";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";

const haptic = () => Haptics.selectionAsync().catch(() => {});

type Props = {
  categories: Category[];
  value?: string;
  onChange: (categoryId: string, suggestedAttributes?: ListingAttributes) => void;
  // What's being sold, for "Looks like..." suggestions.
  title?: string;
  description?: string;
};

// Choosing a category for something you're selling: suggestions from the title
// first, otherwise main categories as tiles; tap one to go into its
// subcategories (any depth). A broad category can be picked too.
export default function CategoryPicker({ categories, value, onChange, title = "", description = "" }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const selected = value ? tree.byId.get(value) : undefined;
  // Where the browser is looking: undefined = the main categories.
  const [browsing, setBrowsing] = useState<string | undefined>();
  const [open, setOpen] = useState(!value);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const asked = useRef("");

  // Suggest from the title (once per title), and pre-pick the top one if
  // nothing is chosen yet.
  useEffect(() => {
    const t = title.trim();
    if (t.length < 3 || asked.current === t) return;
    asked.current = t;
    setThinking(true);
    api
      .suggestCategory(t, description)
      .then(({ suggestions: list }) => {
        setSuggestions(list);
        if (!value && list[0]) {
          onChange(list[0].id, list[0].attributes);
          setOpen(false);
        }
      })
      .catch(() => setSuggestions([]))
      .finally(() => setThinking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const choose = (c: Category, attrs?: ListingAttributes) => {
    haptic();
    onChange(c.id, attrs ?? suggestions?.find((s) => s.id === c.id)?.attributes);
    setOpen(false);
  };
  const goInto = (c: Category) => {
    haptic();
    if (tree.childrenOf(c.slug).length) setBrowsing(c.slug);
    else choose(c);
  };

  const columns = width >= 600 ? 4 : 3;
  const level = tree.childrenOf(browsing);
  const here = browsing ? tree.bySlug.get(browsing) : undefined;
  const otherSuggestions = (suggestions ?? []).filter((s) => s.id !== value);

  return (
    <View style={{ gap: spacing.sm }}>
      {selected && !open && (
        <Pop key={selected.id} from={0.96}>
          <SelectedCard
            tree={tree}
            category={selected}
            // Open beside the current choice, so its neighbours are one tap away.
            onChange={() => {
              setBrowsing(selected.parentId ? tree.byId.get(selected.parentId)?.slug : undefined);
              setOpen(true);
            }}
          />
        </Pop>
      )}

      {thinking && !suggestions && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.thinkingText}>Finding the right category...</Text>
        </View>
      )}

      {otherSuggestions.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <View style={styles.suggestHead}>
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.suggestLabel}>{selected ? "Or maybe" : "Looks like"}</Text>
          </View>
          {otherSuggestions.slice(0, selected ? 2 : 3).map((s, i) => {
            const c = tree.byId.get(s.id);
            if (!c) return null;
            const { Icon, color } = categoryLook(c, tree);
            return (
              <FadeIn key={s.id} delay={i * 50}>
                <Tap style={styles.suggestRow} onPress={() => choose(c, s.attributes)} scaleTo={0.98} accessibilityLabel={`Choose ${s.path.map((p) => p.name).join(", ")}`}>
                  <View style={[styles.suggestIcon, { backgroundColor: color + "1F" }]}>
                    <Icon size={18} color={color} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.suggestPath} numberOfLines={2}>
                    {s.path.slice(0, -1).map((p) => `${p.name} › `)}
                    <Text style={styles.suggestLeaf}>{s.path[s.path.length - 1]?.name}</Text>
                  </Text>
                </Tap>
              </FadeIn>
            );
          })}
        </View>
      )}

      {(open || !selected) && (
        <View style={styles.browser}>
          {here ? (
            <View style={styles.browserHead}>
              <Tap style={styles.back} onPress={() => (haptic(), setBrowsing(here.parentId ? tree.byId.get(here.parentId)?.slug : undefined))} scaleTo={0.9} accessibilityLabel="Back">
                <ChevronLeft size={20} color={colors.text} />
              </Tap>
              <Text style={styles.browserTitle} numberOfLines={1}>
                {tree
                  .pathOf(here.slug)
                  .map((c) => c.name)
                  .join(" › ")}
              </Text>
            </View>
          ) : (
            <Text style={styles.browserTitle}>{selected ? "Choose another category" : "Or choose a category"}</Text>
          )}

          {here ? (
            <FadeIn key={here.slug} style={{ gap: spacing.xs }}>
              {/* The broad category itself, for things that don't fit a sub. */}
              <Tap style={[styles.subRow, styles.subRowAll]} onPress={() => choose(here)} scaleTo={0.98}>
                <Text style={[styles.subName, { color: colors.primary }]}>All of {here.name}</Text>
                {value === here.id && <Check size={18} color={colors.primary} strokeWidth={3} />}
              </Tap>
              {level.map((c) => {
                const { Icon, color } = categoryLook(c, tree);
                const deeper = tree.childrenOf(c.slug).length > 0;
                const on = value === c.id;
                return (
                  <Tap key={c.id} style={[styles.subRow, on && styles.subRowOn]} onPress={() => goInto(c)} scaleTo={0.98} accessibilityLabel={deeper ? `${c.name}, has more choices` : `Choose ${c.name}`}>
                    <View style={[styles.subIcon, { backgroundColor: color + "1F" }]}>
                      <Icon size={17} color={color} strokeWidth={2.2} />
                    </View>
                    <Text style={[styles.subName, on && { color: colors.primary }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {on ? <Check size={18} color={colors.primary} strokeWidth={3} /> : deeper ? <ChevronRight size={18} color={colors.textMuted} /> : null}
                  </Tap>
                );
              })}
            </FadeIn>
          ) : (
            <FadeIn key="roots" style={styles.grid}>
              {level.map((c) => {
                const { Icon, color } = categoryLook(c, tree);
                const on = selected && tree.topOf(selected.slug)?.id === c.id;
                return (
                  <Tap key={c.id} style={[styles.tile, { width: `${100 / columns - 2}%` as const }, on && { borderColor: color }]} onPress={() => goInto(c)} scaleTo={0.94} accessibilityLabel={c.name}>
                    <View style={[styles.tileIcon, { backgroundColor: color + "1F" }]}>
                      <Icon size={22} color={color} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.tileName} numberOfLines={2}>
                      {c.name}
                    </Text>
                  </Tap>
                );
              })}
            </FadeIn>
          )}
        </View>
      )}
    </View>
  );
}

function SelectedCard({ tree, category, onChange }: { tree: CategoryTree; category: Category; onChange: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { Icon, color } = categoryLook(category, tree);
  const path = tree.pathOf(category.slug);
  return (
    <View style={[styles.selected, { borderColor: color }]}>
      <View style={[styles.selectedIcon, { backgroundColor: color }]}>
        <Icon size={22} color="#fff" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {path.length > 1 && (
          <Text style={styles.selectedTrail} numberOfLines={1}>
            {path
              .slice(0, -1)
              .map((c) => c.name)
              .join(" › ")}
          </Text>
        )}
        <Text style={styles.selectedName} numberOfLines={1}>
          {category.name}
        </Text>
      </View>
      <Tap style={styles.change} onPress={onChange} scaleTo={0.92} accessibilityLabel="Change category">
        <Pencil size={14} color={colors.primary} />
        <Text style={styles.changeText}>Change</Text>
      </Tap>
    </View>
  );
}

// The chosen category's questions: chips for choices, a box for numbers.
// All optional; they power Search's filters.
export function AttributeFields({ defs, value, onChange }: { defs: AttributeDef[]; value: ListingAttributes; onChange: (next: ListingAttributes) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!defs.length) return null;
  const set = (key: string, v: string | number | undefined) => {
    const { [key]: _drop, ...rest } = value;
    onChange(v === undefined || v === "" ? rest : { ...rest, [key]: v });
  };
  return (
    <View style={styles.details}>
      <Text style={styles.detailsTitle}>Details</Text>
      <Text style={styles.detailsHint}>Optional, but buyers filter by these.</Text>
      {defs.map((def) => (
        <View key={def.key} style={{ marginTop: spacing.sm }}>
          <Text style={styles.detailLabel}>
            {def.label}
            {def.unit ? ` (${def.unit})` : ""}
          </Text>
          {def.type === "select" ? (
            <View style={styles.optionWrap}>
              {(def.options ?? []).map((o) => {
                const on = value[def.key] === o;
                return (
                  <Tap key={o} style={[styles.option, on && styles.optionOn]} onPress={() => (haptic(), set(def.key, on ? undefined : o))} scaleTo={0.92} accessibilityState={{ selected: on }}>
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{o}</Text>
                  </Tap>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.numberInput}
              value={value[def.key] !== undefined ? String(value[def.key]) : ""}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, 8);
                set(def.key, digits ? Number(digits) : undefined);
              }}
              keyboardType="number-pad"
              placeholder={def.key === "year" ? "e.g. 2020" : def.unit ? `In ${def.unit}` : ""}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={def.label}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  thinking: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm },
  thinkingText: { fontSize: fontSize.sm, color: colors.textMuted },
  suggestHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  suggestLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border },
  suggestIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  suggestPath: { flex: 1, fontSize: fontSize.sm, color: colors.textMuted },
  suggestLeaf: { fontWeight: fontWeight.bold, color: colors.text },
  selected: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, borderWidth: 2, ...cardShadow },
  selectedIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  selectedTrail: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  selectedName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  change: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  changeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  browser: { gap: spacing.sm, marginTop: spacing.xs },
  browserHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", ...cardShadow },
  browserTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  tile: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: "center", gap: spacing.sm, borderWidth: 2, borderColor: "transparent", ...cardShadow },
  tileIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tileName: { fontSize: fontSize.caption + 1, fontWeight: fontWeight.bold, color: colors.text, textAlign: "center", minHeight: 32 },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, minHeight: 56, ...cardShadow },
  subRowAll: { backgroundColor: colors.primaryTint, justifyContent: "space-between", paddingHorizontal: spacing.md },
  subRowOn: { borderWidth: 2, borderColor: colors.primary },
  subIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  subName: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  details: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  detailsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  detailsHint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  detailLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 6 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  optionTextOn: { color: "#fff" },
  numberInput: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background },
}));
