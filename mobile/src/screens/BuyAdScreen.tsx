import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Megaphone, Check, Globe } from "lucide-react-native";
import { api, errorMessage, Listing, mediaUrl, MoneyConfig, newClientId, uploadMedia } from "../api/client";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import PlanPicker from "../components/PlanPicker";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { usePersistentState } from "../hooks/usePersistentState";
import { discounted, useDiscount } from "../api/SiteContext";
import DiscountRibbon from "../components/DiscountRibbon";

const WEBSITE = "website";

export default function BuyAdScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { user } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const [config, setConfig] = useState<MoneyConfig | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [draft, setDraft] = usePersistentState(`${DRAFT_PREFIX}ad.${user?.id}`, { title: "", image: "", target: "", url: "", days: 7 });
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const clientId = useRef(newClientId());

  useEffect(() => {
    api.moneyConfig().then(setConfig).catch((e) => toast.error(errorMessage(e)));
    if (user) api.myListings(user.id, "ACTIVE").then(setListings).catch(() => {});
  }, [user, toast]);

  const [pickPhoto, uploading] = useSingleFlight(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast.error("Please allow photo access to add a picture.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const { url } = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg");
      set({ image: url });
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't upload that photo. Please try again."));
    }
  });

  const isWebsite = draft.target === WEBSITE;
  const ready = draft.title.trim().length >= 3 && !!draft.image && (isWebsite ? draft.url.trim().startsWith("https://") : !!draft.target);

  const [buy, buying] = useSingleFlight(async () => {
    if (!ready) return toast.error("Please add a headline, a photo and where the ad leads.");
    try {
      await api.createPurchase(
        { kind: "AD", days: draft.days, adTitle: draft.title.trim(), adImage: draft.image, ...(isWebsite ? { adUrl: draft.url.trim() } : { listingId: draft.target }) },
        `${clientId.current}-${draft.days}`
      );
      setDraft({ title: "", image: "", target: "", url: "", days: 7 });
      navigation.replace("Purchases");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const discount = useDiscount("AD");
  const basePrice = config ? config.adPrices[String(draft.days) as keyof typeof config.adPrices] : null;
  const price = basePrice !== null ? discounted(basePrice, discount?.percent) : null;
  // Plan prices shown after the discount.
  const shownPrices = config ? (Object.fromEntries(Object.entries(config.adPrices).map(([k, v]) => [k, discounted(v, discount?.percent)])) as typeof config.adPrices) : null;
  const step = !draft.image || draft.title.trim().length < 3 ? 1 : !(isWebsite ? draft.url.trim().startsWith("https://") : !!draft.target) ? 2 : 3;

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Advertise on Alibe" />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!!discount && <DiscountRibbon label={discount.label} percent={discount.percent} />}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Megaphone size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Reach everyone who opens Alibe</Text>
              <Text style={styles.heroText}>Your ad sits on the home page with an "Ad" label. We check it first, and it starts once your payment is confirmed.</Text>
            </View>
          </View>

          {/* Live preview */}
          <Text style={styles.label}>Preview</Text>
          <View style={styles.preview}>
            {draft.image ? (
              <Image source={{ uri: mediaUrl(draft.image) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.previewEmpty]}>
                <ImagePlus size={26} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.previewShade} />
            <View style={styles.adTag}>
              <Text style={styles.adTagText}>Ad</Text>
            </View>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {draft.title.trim() || "Your headline here"}
            </Text>
          </View>

          <Section n={1} title="Photo and headline" done={step > 1}>
            <Tap style={styles.photo} onPress={() => pickPhoto()} disabled={uploading} scaleTo={0.98} accessibilityLabel="Choose a photo for your ad">
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <ImagePlus size={20} color={colors.primary} />
                  <Text style={styles.photoText}>{draft.image ? "Change photo" : "Add a wide photo"}</Text>
                </>
              )}
            </Tap>
            <View>
              <TextInput style={styles.input} value={draft.title} onChangeText={(title) => set({ title })} placeholder="e.g. Fresh tuna delivered in Malé" placeholderTextColor={colors.textMuted} maxLength={60} accessibilityLabel="Headline" />
              <Text style={styles.counter}>{draft.title.length}/60</Text>
            </View>
          </Section>

          <Section n={2} title="Where it leads" done={step > 2}>
            <View style={styles.targets}>
              {listings.slice(0, 8).map((l) => {
                const on = draft.target === l.id;
                return (
                  <Tap key={l.id} style={[styles.target, on && styles.targetOn]} onPress={() => set({ target: l.id })} scaleTo={0.97}>
                    <Image source={{ uri: mediaUrl(l.images[0]) }} style={styles.targetThumb} />
                    <Text style={[styles.targetText, on && { color: colors.primary }]} numberOfLines={1}>
                      {l.title}
                    </Text>
                    {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
                  </Tap>
                );
              })}
              <Tap style={[styles.target, isWebsite && styles.targetOn]} onPress={() => set({ target: WEBSITE })} scaleTo={0.97}>
                <View style={[styles.targetThumb, styles.targetIcon]}>
                  <Globe size={18} color={colors.primary} />
                </View>
                <Text style={[styles.targetText, isWebsite && { color: colors.primary }]}>My website</Text>
                {isWebsite && <Check size={16} color={colors.primary} strokeWidth={3} />}
              </Tap>
            </View>
            {isWebsite && (
              <TextInput style={styles.input} value={draft.url} onChangeText={(url) => set({ url })} placeholder="https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Website address" maxLength={300} />
            )}
          </Section>

          <Section n={3} title="How long" done={false}>
            {config ? (
              <PlanPicker prices={shownPrices!} days={draft.days} onChange={(days) => set({ days })} />
            ) : (
              <SkeletonGroup>
                <Skeleton width="100%" height={76} rounded={radius.lg} />
              </SkeletonGroup>
            )}
          </Section>

          <View style={styles.total}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalSub}>{draft.days} days on the home page</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {!!discount && basePrice !== null && <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textDecorationLine: "line-through" }}>MVR {basePrice.toLocaleString()}</Text>}
              <Text style={styles.totalPrice}>{price !== null ? `MVR ${price.toLocaleString()}` : "..."}</Text>
            </View>
          </View>
          <Tap style={[styles.button, !ready && { opacity: 0.45 }]} onPress={() => buy()} disabled={buying || !config} scaleTo={0.97}>
            {buying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue to payment</Text>}
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.num, done && { backgroundColor: colors.success }]}>{done ? <Check size={13} color="#fff" strokeWidth={3} /> : <Text style={styles.numText}>{n}</Text>}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: contentWidth.form, alignSelf: "center", gap: spacing.md, flexGrow: 1, justifyContent: "center" },
  hero: { flexDirection: "row", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primaryTint },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  heroText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 3, lineHeight: 19 },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: -spacing.sm },
  preview: { width: "100%", aspectRatio: 2.4, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.card, justifyContent: "flex-end", padding: spacing.md, ...cardShadow },
  previewEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.skeleton },
  previewShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%", backgroundColor: "rgba(0,0,0,0.35)" },
  adTag: { position: "absolute", top: 10, left: 10, paddingHorizontal: 8, height: 20, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center" },
  adTagText: { color: "#fff", fontSize: 11, fontWeight: fontWeight.extrabold },
  previewTitle: { color: "#fff", fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm + 4, ...cardShadow },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  numText: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.extrabold },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  photo: { flexDirection: "row", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryTint },
  photoText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  input: { minHeight: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  counter: { fontSize: fontSize.micro, color: colors.textMuted, alignSelf: "flex-end", marginTop: 4 },
  targets: { gap: 6 },
  target: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: 6, paddingRight: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  targetOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  targetThumb: { width: 38, height: 38, borderRadius: 9, backgroundColor: colors.skeleton },
  targetIcon: { backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  targetText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  total: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xs, marginTop: spacing.xs },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  totalSub: { fontSize: fontSize.caption, color: colors.textMuted },
  totalPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.primary },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
}));
