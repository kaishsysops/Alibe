import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus } from "lucide-react-native";
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

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Advertise on Alibe" />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Your ad appears on the Alibe home page with an "Ad" label. We check each ad first, and it starts once your payment is confirmed.</Text>

          <Text style={styles.label}>Photo</Text>
          <Tap style={styles.photo} onPress={() => pickPhoto()} disabled={uploading} scaleTo={0.98} accessibilityLabel="Choose a photo for your ad">
            {draft.image ? (
              <Image source={{ uri: mediaUrl(draft.image) }} style={styles.photoImage} resizeMode="cover" />
            ) : uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <ImagePlus size={26} color={colors.primary} />
                <Text style={styles.photoText}>Add a wide photo</Text>
              </>
            )}
          </Tap>

          <Text style={styles.label}>Headline</Text>
          <TextInput style={styles.input} value={draft.title} onChangeText={(title) => set({ title })} placeholder="e.g. Fresh tuna delivered in Malé" placeholderTextColor={colors.textMuted} maxLength={60} accessibilityLabel="Headline" />

          <Text style={styles.label}>When people tap your ad, show them</Text>
          <View style={styles.chips}>
            {listings.slice(0, 8).map((l) => (
              <Tap key={l.id} style={[styles.chip, draft.target === l.id && styles.chipActive]} onPress={() => set({ target: l.id })} scaleTo={0.95}>
                <Text style={[styles.chipText, draft.target === l.id && { color: "#fff" }]} numberOfLines={1}>
                  {l.title}
                </Text>
              </Tap>
            ))}
            <Tap style={[styles.chip, isWebsite && styles.chipActive]} onPress={() => set({ target: WEBSITE })} scaleTo={0.95}>
              <Text style={[styles.chipText, isWebsite && { color: "#fff" }]}>My website</Text>
            </Tap>
          </View>
          {isWebsite && (
            <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={draft.url} onChangeText={(url) => set({ url })} placeholder="https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Website address" maxLength={300} />
          )}

          <Text style={styles.label}>How long?</Text>
          {config ? (
            <PlanPicker prices={config.adPrices} days={draft.days} onChange={(days) => set({ days })} />
          ) : (
            <SkeletonGroup>
              <Skeleton width="100%" height={76} rounded={radius.lg} />
            </SkeletonGroup>
          )}

          <Tap style={[styles.button, !ready && { opacity: 0.45 }]} onPress={() => buy()} disabled={buying || !config} scaleTo={0.97}>
            {buying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue to payment</Text>}
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: contentWidth.form, alignSelf: "center" },
  intro: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: fontSize.md * 1.4 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  photo: { width: "100%", aspectRatio: 2.4, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", overflow: "hidden", gap: spacing.xs, ...cardShadow },
  photoImage: { width: "100%", height: "100%" },
  photoText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  input: { minHeight: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { maxWidth: "100%", height: 42, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
}));
