import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronRight, ChevronUp, ChevronDown, Plus, Eye, EyeOff, Pencil, Trash2, FolderTree } from "lucide-react-native";
import { api, AdminCategory, errorMessage } from "../api/client";
import { buildCategoryTree } from "../utils/categoryTree";
import { categoryLook } from "../theme/categoryIcons";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { Sheet } from "../components/Sheet";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { RowSkeleton } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, contentWidth, controlHeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

type Editing = { mode: "add"; parentId: string | null } | { mode: "edit"; category: AdminCategory };

// Staff only: the category tree, one level at a time. Add subcategories at any
// depth, rename, set search words, hide, reorder, delete. Changes show in the
// app within a minute.
export default function AdminCategoriesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const parentSlug: string | undefined = route.params?.slug;
  const { isDesktopWeb, gutter } = useResponsive();
  const [rows, setRows] = useState<AdminCategory[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api.adminCategories());
    } catch (e) {
      setRows((r) => r ?? []);
      toast.error(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  // Coming back from a deeper level picks up what changed there.
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  const tree = useMemo(() => buildCategoryTree(rows ?? []), [rows]);
  const parent = parentSlug ? (tree.bySlug.get(parentSlug) as AdminCategory | undefined) : undefined;
  const level = tree.childrenOf(parentSlug) as AdminCategory[];

  const openEditor = (e: Editing) => {
    setEditing(e);
    setName(e.mode === "edit" ? e.category.name : "");
    setKeywords(e.mode === "edit" ? (e.category.keywords ?? []).join(", ") : "");
  };

  const [save, saving] = useSingleFlight(async () => {
    if (!editing || name.trim().length < 2) return;
    const words = keywords
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 1);
    try {
      if (editing.mode === "add") {
        const created = await api.addCategory(name.trim(), editing.parentId);
        if (words.length) await api.updateCategory(created.id, { keywords: words });
        toast.success(`Added ${created.name}.`);
      } else {
        await api.updateCategory(editing.category.id, { name: name.trim(), keywords: words });
        toast.success("Saved.");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  // Optimistic: the row moves at once; a failure puts it back.
  const move = async (c: AdminCategory, direction: "up" | "down") => {
    const before = rows;
    const siblings = level.map((s) => s.id);
    const i = siblings.indexOf(c.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    setRows((r) => r && r.map((x) => (siblings.includes(x.id) ? { ...x, sortOrder: siblings.indexOf(x.id) } : x)));
    try {
      await api.moveCategory(c.id, direction);
    } catch (e) {
      setRows(before);
      toast.error(errorMessage(e));
    }
  };

  const toggleHidden = async (c: AdminCategory) => {
    const before = rows;
    setRows((r) => r && r.map((x) => (x.id === c.id ? { ...x, hidden: !c.hidden } : x)));
    try {
      await api.updateCategory(c.id, { hidden: !c.hidden });
      toast.success(c.hidden ? `${c.name} is back in the app.` : `${c.name} is hidden. Its listings stay up.`);
    } catch (e) {
      setRows(before);
      toast.error(errorMessage(e));
    }
  };

  const remove = (c: AdminCategory) =>
    showAlert({
      title: `Delete ${c.name}?`,
      message: parent ? `Anything listed in it moves up to ${parent.name}.` : "Only possible while it has no listings.",
      kind: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.deleteCategory(c.id);
              toast.success(res.movedTo ? `Deleted. Its items are now in ${res.movedTo}.` : "Deleted.");
              load();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          },
        },
      ],
    });

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title={parent?.name ?? "Categories"} />}
      {!rows ? (
        <View style={{ padding: gutter }}>
          <RowSkeleton count={8} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}>
          <Text style={styles.help}>
            {parent ? `Subcategories of ${tree.pathOf(parent.slug).map((c) => c.name).join(" › ")}. ` : ""}Shown in this order everywhere. Tap a row to see what's inside it.
          </Text>
          <Tap style={styles.add} onPress={() => openEditor({ mode: "add", parentId: parent?.id ?? null })} scaleTo={0.97}>
            <Plus size={18} color="#fff" strokeWidth={2.6} />
            <Text style={styles.addText}>{parent ? `Add a subcategory to ${parent.name}` : "Add a top category"}</Text>
          </Tap>
          {level.length === 0 && (
            <View style={styles.empty}>
              <FolderTree size={28} color={colors.textMuted} />
              <Text style={styles.meta}>No subcategories yet.</Text>
            </View>
          )}
          {level.map((c, i) => {
            const { Icon, color } = categoryLook(c, tree);
            const kids = tree.childrenOf(c.slug).length;
            return (
              <View key={c.id} style={[styles.card, c.hidden && { opacity: 0.55 }]}>
                <Tap style={styles.row} onPress={() => navigation.push("AdminCategories", { slug: c.slug })} scaleTo={0.99} accessibilityLabel={`Open ${c.name}`}>
                  <View style={[styles.icon, { backgroundColor: color + "1F" }]}>
                    <Icon size={18} color={color} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name}
                      {c.hidden ? " (hidden)" : ""}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {kids ? `${kids} subcategories · ` : ""}
                      {c.ownCount} listed here
                      {c.keywords?.length ? ` · ${c.keywords.length} search words` : ""}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </Tap>
                <View style={styles.actions}>
                  <Action icon={ChevronUp} label="Up" disabled={i === 0} onPress={() => move(c, "up")} />
                  <Action icon={ChevronDown} label="Down" disabled={i === level.length - 1} onPress={() => move(c, "down")} />
                  <Action icon={Pencil} label="Edit" onPress={() => openEditor({ mode: "edit", category: c })} />
                  <Action icon={c.hidden ? Eye : EyeOff} label={c.hidden ? "Show" : "Hide"} onPress={() => toggleHidden(c)} />
                  <Action icon={Trash2} label="Delete" danger disabled={kids > 0} onPress={() => remove(c)} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.mode === "edit" ? `Edit ${editing.category.name}` : parent ? `New subcategory in ${parent.name}` : "New top category"}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Gaming laptops" placeholderTextColor={colors.textMuted} maxLength={60} autoFocus accessibilityLabel="Category name" />
          <Text style={[styles.label, { marginTop: spacing.sm }]}>Search words</Text>
          <Text style={styles.meta}>Other words people use for it, separated by commas. Search and auto-categorising use them.</Text>
          <TextInput
            style={[styles.input, { height: 88, paddingTop: spacing.sm, textAlignVertical: "top" }]}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="e.g. gaming laptop, rog, legion"
            placeholderTextColor={colors.textMuted}
            multiline
            autoCapitalize="none"
            accessibilityLabel="Search words"
          />
          <Tap style={[styles.save, (name.trim().length < 2 || saving) && { opacity: 0.45 }]} onPress={() => save()} disabled={name.trim().length < 2 || saving} scaleTo={0.97}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editing?.mode === "edit" ? "Save" : "Add category"}</Text>}
          </Tap>
        </View>
      </Sheet>
    </View>
  );
}

function Action({ icon: Icon, label, onPress, disabled, danger }: { icon: React.ComponentType<{ size: number; color: string }>; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Tap style={[styles.action, disabled && { opacity: 0.3 }]} onPress={onPress} disabled={disabled} scaleTo={0.9} accessibilityLabel={label}>
      <Icon size={16} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Tap>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, gap: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", paddingBottom: spacing.xl },
  help: { fontSize: fontSize.sm, color: colors.textMuted },
  add: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", height: controlHeight.secondary, borderRadius: radius.pill, backgroundColor: colors.primary },
  addText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 2, ...cardShadow },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  action: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4, borderRadius: radius.sm },
  actionText: { fontSize: 11, fontWeight: fontWeight.semibold },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background },
  save: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  saveText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
