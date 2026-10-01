import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Image, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, ChevronLeft, Check, TrendingUp, Star, X, Plus } from "lucide-react-native";
import { api, Category, Atoll, Island, newClientId, errorMessage, Listing, DeliveryOption, uploadMedia, mediaUrl } from "../api/client";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, cardShadow, tabBarClearance, fontSize, fontWeight } from "../theme/theme";
import { categoryIcons } from "../theme/categoryIcons";
import { useResponsive } from "../hooks/useResponsive";
import { usePersistentState } from "../hooks/usePersistentState";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";

const CONDITIONS: Array<{ value: Listing["condition"]; label: string; hint: string }> = [
  { value: "NEW", label: "New", hint: "Unused, in original packaging" },
  { value: "LIKE_NEW", label: "Like new", hint: "Used once or twice, no marks" },
  { value: "GOOD", label: "Good", hint: "Normal wear, works perfectly" },
  { value: "FAIR", label: "Fair", hint: "Visible wear or minor faults" },
];
const MAX_IMAGES = 6;
const DELIVERY: Array<{ value: DeliveryOption; label: string; hint: string }> = [
  { value: "PICKUP", label: "Pickup", hint: "Buyer collects from you" },
  { value: "FERRY", label: "Ferry cargo", hint: "Send to another island" },
  { value: "COURIER", label: "Courier", hint: "Local delivery on your island" },
];
const MAX_FORM_WIDTH = 600;
const STEPS = ["Photos", "Details", "Category", "Location"];

type Draft = {
  step: number;
  images: string[];
  coverIndex: number;
  title: string;
  description: string;
  price: string;
  condition: Listing["condition"];
  categoryId?: string;
  islandId?: string;
  deliveryOptions: DeliveryOption[];
  deliveryNote: string;
  // Generated once per draft: a double-tapped or retried publish reuses it,
  // so the backend can never create the same listing twice.
  requestId: string;
};

const emptyDraft = (): Draft => ({
  step: 0,
  images: [],
  coverIndex: 0,
  title: "",
  description: "",
  price: "",
  condition: "GOOD",
  deliveryOptions: ["PICKUP"],
  deliveryNote: "",
  requestId: newClientId(),
});

export default function SellScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { isDesktopWeb, gutter } = useResponsive();
  const [categories, setCategories] = useState<Category[]>([]);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [priceHint, setPriceHint] = useState<{ min: number; max: number } | null>(null);
  const [draft, setDraft, { hydrated, clear }] = usePersistentState<Draft>(`${DRAFT_PREFIX}sell.${user?.id}`, emptyDraft());
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const { step, images, coverIndex, title, description, price, condition, categoryId, islandId } = draft;

  useEffect(() => {
    api.categories().then(setCategories).catch(() => toast.error("Couldn't load categories. Check your connection."));
    api.atolls().then(setAtolls).catch(() => {});
  }, [toast]);

  useEffect(() => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return setPriceHint(null);
    api
      .listings({ categorySlug: category.slug })
      .then((listings) => {
        if (listings.length < 3) return setPriceHint(null);
        const prices = listings.map((l) => l.price).sort((a, b) => a - b);
        setPriceHint({ min: prices[Math.floor(prices.length * 0.2)], max: prices[Math.floor(prices.length * 0.8)] });
      })
      .catch(() => setPriceHint(null));
  }, [categoryId, categories]);

  const goBack = useCallback(() => {
    if (step === 0) return false;
    setDraft((d) => ({ ...d, step: d.step - 1 }));
    return true;
  }, [step, setDraft]);

  // Android hardware back steps back through the form instead of leaving it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", goBack);
      return () => sub.remove();
    }, [goBack])
  );

  const islands: Island[] = atolls.flatMap((a) => a.islands);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedIsland = islands.find((i) => i.id === islandId);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error("Allow photo access in Settings to add listing images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_IMAGES - images.length),
      quality: 0.7,
    });
    if (result.canceled) return;
    update({ images: [...images, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES) });
  };

  const removeImage = (index: number) =>
    setDraft((d) => ({
      ...d,
      images: d.images.filter((_, i) => i !== index),
      coverIndex: index === d.coverIndex ? 0 : index < d.coverIndex ? d.coverIndex - 1 : d.coverIndex,
    }));

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [publish, publishing] = useSingleFlight(async () => {
    if (!user || !categoryId || !islandId) return;
    try {
      // Photos picked on this device are uploaded first so every buyer can
      // see them. Already-uploaded paths are remembered in the draft, so a
      // retry after a failure doesn't upload them again.
      const ordered = [images[coverIndex], ...images.filter((_, i) => i !== coverIndex)];
      const uploaded: string[] = [];
      for (const [i, uri] of ordered.entries()) {
        if (uri.startsWith("/uploads/") || uri.startsWith("http")) {
          uploaded.push(uri);
          continue;
        }
        setUploadProgress(`Uploading photo ${i + 1} of ${ordered.length}`);
        const result = await uploadMedia(uri, uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
        uploaded.push(result.url);
        setDraft((d) => ({ ...d, images: d.images.map((x) => (x === uri ? result.url : x)) }));
      }
      setUploadProgress("Publishing");
      const listing = await api.createListing({
        title: title.trim(),
        description: description.trim() || "No description provided.",
        price: Number(price),
        condition,
        categoryId,
        islandId,
        sellerId: user.id,
        images: uploaded,
        deliveryOptions: draft.deliveryOptions?.length ? draft.deliveryOptions : ["PICKUP"],
        deliveryNote: draft.deliveryNote?.trim() || null,
        clientRequestId: draft.requestId,
      });
      clear();
      toast.success("Your listing is live.", { label: "View", onPress: () => navigation.navigate("ProductDetail", { id: listing.id }) });
      navigation.navigate("ProductDetail", { id: listing.id });
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't publish. Your draft is saved, so try again."));
    } finally {
      setUploadProgress(null);
    }
  });

  const stepError = (): string | null => {
    if (step === 0 && images.length === 0) return "Add at least one photo so buyers know what they're getting.";
    if (step === 1 && title.trim().length < 3) return "Give your item a title of at least 3 characters.";
    if (step === 1 && !price) return "Add a price. Use 0 if you're giving it away.";
    if (step === 2 && !categoryId) return "Pick a category.";
    if (step === 3 && !islandId) return "Pick the island buyers will collect from.";
    return null;
  };

  const goNext = () => {
    const error = stepError();
    if (error) return toast.error(error);
    if (step === STEPS.length - 1) return publish();
    update({ step: step + 1 });
  };

  const hintText =
    priceHint && price
      ? Number(price) > priceHint.max
        ? "Your price is above what similar items go for."
        : Number(price) < priceHint.min
        ? "Your price is lower than most, so it should sell fast."
        : "Your price is right in the usual range."
      : null;

  let stepContent: React.ReactNode;
  if (!hydrated) {
    stepContent = (
      <SkeletonGroup>
        <Skeleton width={200} height={26} />
        <Skeleton width="70%" height={14} style={{ marginTop: spacing.sm }} />
        <Skeleton width="100%" height={180} rounded={radius.lg} style={{ marginTop: spacing.lg }} />
      </SkeletonGroup>
    );
  } else if (step === 0) {
    stepContent = (
      <View>
        <Text style={styles.header}>Add photos</Text>
        <Text style={styles.subheader}>
          {images.length > 0 ? "Tap a photo to make it the cover. Buyers see the cover first." : "Up to 6 photos. Bright, clear shots sell faster."}
        </Text>
        <View style={styles.photoGrid}>
          {images.map((uri, i) => (
            <Tap key={uri + i} style={[styles.photoTile, i === coverIndex && styles.photoTileCover]} onPress={() => update({ coverIndex: i })} scaleTo={0.94}>
              <ImageTile uri={uri} />
              <View style={[styles.coverBadge, i !== coverIndex && styles.coverBadgeMuted]}>
                <Star size={11} color="#fff" fill={i === coverIndex ? "#fff" : "transparent"} />
              </View>
              <Tap nested style={styles.removeBadge} onPress={() => removeImage(i)} hitSlop={8} scaleTo={0.8} accessibilityLabel="Remove photo">
                <X size={12} color="#fff" strokeWidth={3} />
              </Tap>
            </Tap>
          ))}
          {images.length < MAX_IMAGES && (
            <Tap style={styles.photoTileAdd} onPress={pickImages} scaleTo={0.94}>
              {images.length === 0 ? <ImagePlus size={28} color={colors.primary} /> : <Plus size={24} color={colors.primary} />}
              <Text style={styles.photoTileText}>{images.length === 0 ? "Add photos" : "Add more"}</Text>
            </Tap>
          )}
        </View>
      </View>
    );
  } else if (step === 1) {
    stepContent = (
      <View>
        <Text style={styles.header}>Describe it</Text>
        <Text style={styles.subheader}>The key details buyers ask about first.</Text>
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={(t) => update({ title: t })} placeholder="e.g. iPhone 13 Pro 256GB" placeholderTextColor={colors.textMuted} maxLength={80} returnKeyType="next" />
        <Text style={styles.fieldLabel}>Price</Text>
        <View style={styles.priceField}>
          <Text style={styles.currency}>MVR</Text>
          <TextInput style={styles.priceInput} value={price} onChangeText={(t) => update({ price: t.replace(/\D/g, "") })} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} maxLength={9} />
        </View>
        {hintText && <Text style={styles.helper}>{hintText}</Text>}
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={(t) => update({ description: t })}
          multiline
          placeholder="Condition, what's included, reason for selling"
          placeholderTextColor={colors.textMuted}
          maxLength={2000}
        />
        <Text style={styles.counter}>{description.length}/2000</Text>
      </View>
    );
  } else if (step === 2) {
    stepContent = (
      <View>
        <Text style={styles.header}>Category and condition</Text>
        <Text style={styles.subheader}>Helps the right buyers find it.</Text>
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipGrid}>
          {categories.map((c) => {
            const meta = categoryIcons[c.slug];
            const Icon = meta?.Icon;
            const active = categoryId === c.id;
            return (
              <Tap key={c.id} style={[styles.chip, active && styles.chipActive]} onPress={() => update({ categoryId: c.id })} scaleTo={0.92}>
                {Icon && <Icon size={15} color={active ? "#fff" : meta.color} />}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
              </Tap>
            );
          })}
        </View>
        {priceHint && selectedCategory && (
          <View style={styles.priceHintCard}>
            <TrendingUp size={16} color={colors.primary} />
            <Text style={styles.priceHintText}>
              {selectedCategory.name} usually sells for{" "}
              <Text style={styles.priceHintStrong}>
                MVR {priceHint.min.toLocaleString()} to {priceHint.max.toLocaleString()}
              </Text>
              .
            </Text>
          </View>
        )}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Condition</Text>
        <View style={{ gap: spacing.sm }}>
          {CONDITIONS.map((c) => {
            const active = condition === c.value;
            return (
              <Tap key={c.value} style={[styles.option, active && styles.optionActive]} onPress={() => update({ condition: c.value })} scaleTo={0.98}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, active && { color: colors.primary }]}>{c.label}</Text>
                  <Text style={styles.optionHint}>{c.hint}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>{active && <Check size={13} color="#fff" strokeWidth={3} />}</View>
              </Tap>
            );
          })}
        </View>
      </View>
    );
  } else {
    stepContent = (
      <View>
        <Text style={styles.header}>Where is it?</Text>
        <Text style={styles.subheader}>Pick the island buyers will collect from.</Text>
        {atolls.map((a) => (
          <View key={a.id} style={{ marginBottom: spacing.md }}>
            <Text style={styles.groupLabel}>{a.name}</Text>
            <View style={styles.chipGrid}>
              {a.islands.map((i) => (
                <Tap key={i.id} style={[styles.chip, islandId === i.id && styles.chipActive]} onPress={() => update({ islandId: i.id })} scaleTo={0.92}>
                  <Text style={[styles.chipText, islandId === i.id && styles.chipTextActive]}>{i.name}</Text>
                </Tap>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.fieldLabel}>How can buyers get it?</Text>
        <View style={{ gap: spacing.sm }}>
          {DELIVERY.map((d) => {
            const active = draft.deliveryOptions.includes(d.value);
            return (
              <Tap
                key={d.value}
                style={[styles.option, active && styles.optionActive]}
                onPress={() =>
                  setDraft((prev) => {
                    const has = prev.deliveryOptions.includes(d.value);
                    const next = has ? prev.deliveryOptions.filter((x) => x !== d.value) : [...prev.deliveryOptions, d.value];
                    // At least one way to get the item must stay selected.
                    return next.length ? { ...prev, deliveryOptions: next } : prev;
                  })
                }
                scaleTo={0.98}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, active && { color: colors.primary }]}>{d.label}</Text>
                  <Text style={styles.optionHint}>{d.hint}</Text>
                </View>
                <View style={[styles.checkbox, active && styles.radioActive]}>{active && <Check size={13} color="#fff" strokeWidth={3} />}</View>
              </Tap>
            );
          })}
        </View>
        {(draft.deliveryOptions.includes("FERRY") || draft.deliveryOptions.includes("COURIER")) && (
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            value={draft.deliveryNote}
            onChangeText={(t) => update({ deliveryNote: t })}
            placeholder="Delivery note, e.g. buyer pays the ferry cargo fee"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />
        )}

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Review</Text>
        <View style={styles.reviewCard}>
          {images.length > 0 && (
            <View style={styles.reviewPhotoRow}>
              <ImageTile uri={images[coverIndex]} style={styles.reviewPhoto} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle} numberOfLines={2}>
                  {title || "Untitled"}
                </Text>
                <Text style={styles.reviewPrice}>MVR {Number(price || 0).toLocaleString()}</Text>
              </View>
            </View>
          )}
          {[
            ["Category", selectedCategory?.name],
            ["Condition", CONDITIONS.find((c) => c.value === condition)?.label],
            ["Island", selectedIsland?.name],
            ["Delivery", draft.deliveryOptions.map((o) => DELIVERY.find((d) => d.value === o)?.label).join(", ")],
            ["Photos", `${images.length}`],
          ].map(([label, value]) => (
            <View key={label} style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>{label}</Text>
              <Text style={styles.reviewValue}>{value ?? "Not set"}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const isLastStep = step === STEPS.length - 1;
  const footer = (
    <View style={[styles.footerWrap, { paddingHorizontal: gutter, paddingBottom: isDesktopWeb ? spacing.md : keyboardVisible ? spacing.sm : tabBarClearance - spacing.md }]}>
      <Tap style={styles.nextButton} onPress={goNext} disabled={publishing || !hydrated}>
        {publishing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ActivityIndicator color="#fff" />
            {uploadProgress && <Text style={styles.nextButtonText}>{uploadProgress}</Text>}
          </View>
        ) : (
          <>
            <Text style={styles.nextButtonText}>{isLastStep ? "Publish listing" : `Continue to ${STEPS[step + 1].toLowerCase()}`}</Text>
            {isLastStep && <Check size={18} color="#fff" strokeWidth={2.6} />}
          </>
        )}
      </Tap>
    </View>
  );

  const body = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingHorizontal: gutter - spacing.xs }]}>
        {step > 0 ? (
          <Tap onPress={goBack} style={styles.backButton} hitSlop={10} scaleTo={0.88} accessibilityLabel="Previous step">
            <ChevronLeft size={22} color={colors.text} />
          </Tap>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.stepCounter}>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Text>
        {images.length > 0 || title ? (
          <Tap
            style={styles.discard}
            onPress={() => {
              clear();
              toast.info("Draft cleared.");
            }}
            hitSlop={8}
          >
            <Text style={styles.discardText}>Clear</Text>
          </Tap>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>
      <View style={[styles.progressRow, { paddingHorizontal: gutter }]}>
        {STEPS.map((label, i) => (
          <View key={label} style={[styles.progressSegment, i <= step && styles.progressSegmentDone]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={[styles.stepScroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {stepContent}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <View style={{ width: "100%", maxWidth: MAX_FORM_WIDTH, alignSelf: "center", flex: 1 }}>{body}</View>
      </View>
    );
  }
  return <View style={[styles.container, { paddingTop: insets.top }]}>{body}</View>;
}

function ImageTile({ uri, style }: { uri: string; style?: object }) {
  const styles = useStyles();
  return <Image source={{ uri: mediaUrl(uri) }} style={style ?? styles.photoImage} />;
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepCounter: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
  discard: { height: 40, paddingHorizontal: spacing.sm, justifyContent: "center" },
  discardText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  progressRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressSegmentDone: { backgroundColor: colors.primary },
  stepScroll: { paddingTop: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.3 },
  subheader: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg, lineHeight: fontSize.base * 1.4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoTile: { width: 104, height: 104, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.skeleton },
  photoTileCover: { borderWidth: 2.5, borderColor: colors.primary },
  photoTileAdd: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: { width: "100%", height: "100%" },
  photoTileText: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.bold, marginTop: 4 },
  coverBadge: { position: "absolute", left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  coverBadgeMuted: { backgroundColor: "rgba(20,20,20,0.4)" },
  removeBadge: { position: "absolute", right: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(20,20,20,0.55)", alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  groupLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: fontSize.md,
    color: colors.text,
    outlineStyle: "none" as any,
  },
  textArea: { height: 130, paddingTop: spacing.sm + 4, textAlignVertical: "top" },
  counter: { fontSize: fontSize.caption, color: colors.textMuted, alignSelf: "flex-end", marginTop: 4 },
  priceField: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 50, paddingHorizontal: spacing.md },
  currency: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: fontWeight.semibold, marginRight: spacing.sm },
  priceInput: { flex: 1, height: "100%", fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, outlineStyle: "none" as any },
  helper: { fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.xs + 2, fontWeight: fontWeight.medium },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: "#fff" },
  priceHintCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.sm + 4, marginTop: spacing.md },
  priceHintText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: fontSize.sm * 1.45 },
  priceHintStrong: { fontWeight: fontWeight.bold },
  option: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  optionHint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  reviewPhotoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingBottom: spacing.sm + 4, marginBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewPhoto: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.skeleton },
  reviewTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  reviewPrice: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 2 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  reviewLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  reviewValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold },
  footerWrap: { paddingTop: spacing.sm + 4, backgroundColor: colors.background },
  nextButton: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  nextButtonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
