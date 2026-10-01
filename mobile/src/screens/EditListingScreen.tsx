import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Plus, Star, X, Trash2, Check, PackageSearch } from "lucide-react-native";
import { api, Atoll, Category, DeliveryOption, errorMessage, Listing, mediaUrl, uploadMedia } from "../api/client";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { useAppAlert } from "../components/AppAlertProvider";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { usePersistentState } from "../hooks/usePersistentState";

const CONDITIONS: Array<{ value: Listing["condition"]; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
];
const DELIVERY: Array<{ value: DeliveryOption; label: string }> = [
  { value: "PICKUP", label: "Pickup" },
  { value: "FERRY", label: "Ferry cargo" },
  { value: "COURIER", label: "Courier" },
];
const MAX_IMAGES = 6;

type Form = {
  loaded: boolean;
  images: string[];
  title: string;
  price: string;
  description: string;
  condition: Listing["condition"];
  categoryId: string;
  islandId: string;
  deliveryOptions: DeliveryOption[];
  deliveryNote: string;
};

const EMPTY: Form = { loaded: false, images: [], title: "", price: "", description: "", condition: "GOOD", categoryId: "", islandId: "", deliveryOptions: ["PICKUP"], deliveryNote: "" };

export default function EditListingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { user } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const id: string = route.params.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [missing, setMissing] = useState(false);
  // Unsaved edits survive leaving the screen; cleared once saved.
  const [form, setForm, { hydrated, clear }] = usePersistentState<Form>(`${DRAFT_PREFIX}edit.${id}`, EMPTY);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
    api.atolls().then(setAtolls).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated || form.loaded) return;
    api
      .listing(id)
      .then((l) =>
        setForm({
          loaded: true,
          images: l.images,
          title: l.title,
          price: String(l.price),
          description: l.description,
          condition: l.condition,
          categoryId: l.category.id,
          islandId: l.island.id,
          deliveryOptions: l.deliveryOptions?.length ? l.deliveryOptions : ["PICKUP"],
          deliveryNote: l.deliveryNote ?? "",
        })
      )
      .catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, id]);

  const addPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast.error("Allow photo access in Settings to add listing images.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_IMAGES - form.images.length),
      quality: 0.7,
    });
    if (!result.canceled) set({ images: [...form.images, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES) });
  };

  const [save, saving] = useSingleFlight(async () => {
    if (!user) return;
    if (form.title.trim().length < 3) return toast.error("Give your item a title of at least 3 characters.");
    if (!form.price) return toast.error("Add a price. Use 0 if you're giving it away.");
    if (!form.images.length) return toast.error("Keep at least one photo.");
    try {
      const images: string[] = [];
      for (const uri of form.images) {
        if (uri.startsWith("/uploads/") || uri.startsWith("http")) images.push(uri);
        else images.push((await uploadMedia(uri, uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg")).url);
      }
      await api.updateListing(id, user.id, {
        title: form.title.trim(),
        price: Number(form.price),
        description: form.description.trim() || "No description provided.",
        condition: form.condition,
        categoryId: form.categoryId,
        islandId: form.islandId,
        images,
        deliveryOptions: form.deliveryOptions,
        deliveryNote: form.deliveryNote.trim() || null,
      });
      clear();
      toast.success("Listing updated.");
      navigation.goBack();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your changes. They're kept here, so try again."));
    }
  });

  const [doDelete, deleting] = useSingleFlight(async () => {
    if (!user) return;
    try {
      await api.deleteListing(id, user.id);
      clear();
      toast.success("Listing deleted.");
      navigation.navigate("MyListings");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't delete the listing."));
    }
  });

  const confirmDelete = () =>
    showAlert({
      title: "Delete this listing?",
      message: "It will be removed from Alibe along with its chats and saves. This can't be undone.",
      kind: "error",
      buttons: [{ text: "Keep it", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => doDelete() }],
    });

  const header = isDesktopWeb ? <WebNavBar active="mylistings" /> : <ScreenHeader title="Edit listing" />;

  if (missing) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon={PackageSearch} title="Listing not found" message="It may already have been deleted." actionLabel="My listings" onAction={() => navigation.navigate("MyListings")} />
      </View>
    );
  }

  if (!form.loaded) {
    return (
      <View style={styles.container}>
        {header}
        <SkeletonGroup>
          <View style={{ padding: spacing.md, gap: spacing.md, maxWidth: 640, width: "100%", alignSelf: "center" }}>
            {[110, 200, 140, 120].map((h, i) => (
              <Skeleton key={i} height={h} rounded={radius.lg} />
            ))}
          </View>
        </SkeletonGroup>
      </View>
    );
  }

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Tap key={label} style={[styles.chip, active && styles.chipActive]} onPress={onPress} scaleTo={0.92}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Tap>
  );

  return (
    <View style={styles.container}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.helper}>The first photo is the cover. Tap a photo to make it the cover.</Text>
            <View style={styles.photoGrid}>
              {form.images.map((uri, i) => (
                <Tap key={uri + i} style={[styles.photo, i === 0 && styles.photoCover]} onPress={() => set({ images: [uri, ...form.images.filter((_, j) => j !== i)] })} scaleTo={0.94}>
                  <Image source={{ uri: mediaUrl(uri) }} style={{ width: "100%", height: "100%" }} />
                  {i === 0 && (
                    <View style={styles.coverBadge}>
                      <Star size={11} color="#fff" fill="#fff" />
                    </View>
                  )}
                  <Tap nested style={styles.removeBadge} onPress={() => set({ images: form.images.filter((_, j) => j !== i) })} hitSlop={8} scaleTo={0.8} accessibilityLabel="Remove photo">
                    <X size={12} color="#fff" strokeWidth={3} />
                  </Tap>
                </Tap>
              ))}
              {form.images.length < MAX_IMAGES && (
                <Tap style={styles.addPhoto} onPress={addPhotos} scaleTo={0.94}>
                  <Plus size={22} color={colors.primary} />
                  <Text style={styles.addPhotoText}>Add</Text>
                </Tap>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(t) => set({ title: t })} maxLength={80} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>Price (MVR)</Text>
            <TextInput style={styles.input} value={form.price} onChangeText={(t) => set({ price: t.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={9} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={(t) => set({ description: t })} multiline maxLength={2000} placeholderTextColor={colors.textMuted} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>{categories.map((c) => chip(c.name, form.categoryId === c.id, () => set({ categoryId: c.id })))}</View>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipGrid}>{CONDITIONS.map((c) => chip(c.label, form.condition === c.value, () => set({ condition: c.value })))}</View>
            <Text style={styles.label}>Island</Text>
            <View style={styles.chipGrid}>{atolls.flatMap((a) => a.islands).map((i) => chip(i.name, form.islandId === i.id, () => set({ islandId: i.id })))}</View>
            <Text style={styles.label}>Delivery</Text>
            <View style={styles.chipGrid}>
              {DELIVERY.map((d) =>
                chip(d.label, form.deliveryOptions.includes(d.value), () => {
                  const next = form.deliveryOptions.includes(d.value) ? form.deliveryOptions.filter((x) => x !== d.value) : [...form.deliveryOptions, d.value];
                  if (next.length) set({ deliveryOptions: next });
                  else toast.info("Keep at least one way for buyers to get the item.");
                })
              )}
            </View>
            {form.deliveryOptions.some((d) => d !== "PICKUP") && (
              <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={form.deliveryNote} onChangeText={(t) => set({ deliveryNote: t })} placeholder="Delivery note (optional)" placeholderTextColor={colors.textMuted} maxLength={200} />
            )}
          </View>

          <Tap style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 size={16} color={colors.danger} />}
            <Text style={styles.deleteText}>Delete listing</Text>
          </Tap>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs }]}>
          <Tap style={styles.saveButton} onPress={() => save()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Check size={18} color="#fff" strokeWidth={2.6} />
                <Text style={styles.saveText}>Save changes</Text>
              </>
            )}
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, width: "100%", maxWidth: 640, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  helper: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  textArea: { height: 120, paddingTop: spacing.sm + 2, textAlignVertical: "top" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 92, height: 92, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.skeleton },
  photoCover: { borderWidth: 2.5, borderColor: colors.primary },
  coverBadge: { position: "absolute", left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  removeBadge: { position: "absolute", right: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(20,20,20,0.55)", alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primaryLight, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  addPhotoText: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.bold },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: "#fff" },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2, height: 48 },
  deleteText: { color: colors.danger, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.pill, height: 52, alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 640, alignSelf: "center" },
  saveText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
