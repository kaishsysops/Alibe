import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ExternalLink, PackageX, ShieldAlert, Store } from "lucide-react-native";
import { api, Category, errorMessage, IbayItemDetail } from "../api/client";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ContactCard, hasContactOptions } from "../components/ContactButtons";
import { ListingImage } from "../components/ListingCard";
import { ibayPrice } from "../components/IbayCard";
import PhotoViewer from "../components/PhotoViewer";
import { FadeIn } from "../components/Motion";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import PhotoBadge from "../components/PhotoBadge";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useAuthMethods } from "../hooks/useAuthMethods";

const MAX_WIDTH = contentWidth.list;

export default function IbayItemScreen() {
  const { phone: phoneSignIn } = useAuthMethods();
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { width } = useWindowDimensions();
  const { isDesktopWeb, gutter } = useResponsive();
  const id: string = route.params.id;
  const [item, setItem] = useState<IbayItemDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [missing, setMissing] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const imageSize = Math.min(width, MAX_WIDTH);

  useEffect(() => {
    api.ibayItem(id).then(setItem).catch(() => setMissing(true));
    api.categories().then(setCategories).catch(() => {});
  }, [id]);

  const [claim, claiming] = useSingleFlight(async () => {
    try {
      const listing = await api.claimIbayItem(id);
      toast.success("It's on Alibe now. Check the details and save.");
      navigation.replace("EditListing", { id: listing.id });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const confirmRemove = () =>
    showAlert({
      title: "Remove from Alibe?",
      message: "It stops showing here. Your listing on iBay isn't changed.",
      kind: "info",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            api
              .removeIbayItem(id)
              .then(() => {
                toast.success("Removed from Alibe.");
                navigation.goBack();
              })
              .catch((e) => toast.error(errorMessage(e))),
        },
      ],
    });

  const confirmReport = () =>
    showAlert({
      title: "Report this item?",
      message: "Tell us if it looks like a scam or isn't allowed. We'll take a look.",
      kind: "info",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Report", onPress: () => api.reportIbayItem(id).then(() => toast.success("Thanks. We'll take a look.")).catch((e) => toast.error(errorMessage(e))) },
      ],
    });

  const header = isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="From iBay" />;

  if (missing) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon={PackageX} title="This item has gone" message="It may have been sold or taken down." actionLabel="See other items" onAction={() => navigation.replace("IbayBrowse")} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        {header}
        <SkeletonGroup>
          <View style={{ width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
            <Skeleton width="100%" height={imageSize} rounded={0} />
            <View style={{ padding: gutter, gap: spacing.sm }}>
              <Skeleton width={140} height={28} />
              <Skeleton width="80%" height={18} />
              <Skeleton width="100%" height={110} rounded={radius.lg} style={{ marginTop: spacing.md }} />
            </View>
          </View>
        </SkeletonGroup>
      </View>
    );
  }

  const greeting = `Hi! I saw your "${item.title}" from iBay on the Alibe app. Is it still available?`;
  return (
    <View style={styles.container}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={{ width: imageSize, height: imageSize }}>
          <ScrollView showsVerticalScrollIndicator={false}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / imageSize))}
          >
            {(item.images.length ? item.images : [""]).map((uri, i) => (
              <Tap key={i} onPress={() => uri && setViewing(i)} scaleTo={0.99} accessibilityLabel="Zoom photo">
                <ListingImage uri={uri} style={{ width: imageSize, height: imageSize }} />
              </Tap>
            ))}
          </ScrollView>
          <PhotoBadge label="From iBay" />
          {item.images.length > 1 && <PhotoBadge label={`${photo + 1} of ${item.images.length}`} corner="bottomRight" />}
        </View>
        <PhotoViewer images={item.images} start={viewing} onClose={() => setViewing(null)} />

        <FadeIn style={{ padding: gutter, gap: spacing.md }}>
          <View>
            <Text style={styles.price}>{ibayPrice(item)}</Text>
            {!!item.price && <Text style={styles.priceNote}>Alibe price. Includes our service of buying it for you.</Text>}
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{[categories.find((c) => c.slug === item.categorySlug)?.name, item.condition, item.lastUpdated && `Updated ${item.lastUpdated}`].filter(Boolean).join(" · ")}</Text>
          </View>

          <Tap style={styles.primary} onPress={() => navigation.navigate("BuyForYou", { id: item.id })} scaleTo={0.97}>
            <Text style={styles.primaryText}>Buy through Alibe</Text>
          </Tap>
          <Text style={styles.buyNote}>We check it's available, get it and deliver it to you.</Text>

          {hasContactOptions(item.contact) ? (
            <ContactCard contact={item.contact} listingTitle={item.title} greeting={greeting} />
          ) : (
            <Text style={styles.meta}>We couldn't load this seller's contact details. You can reach them on iBay.</Text>
          )}

          <View style={styles.warning}>
            <ShieldAlert size={20} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Contacting the seller yourself?</Text>
              <Text style={styles.warningText}>They're on iBay, not Alibe, and their own price may be different. Alibe hasn't checked them, and our reviews and handover code don't cover a direct sale. See the item before you pay anything.</Text>
            </View>
          </View>

          {!!item.description && (
            <View style={styles.card}>
              <Text style={styles.heading}>From the seller</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}

          <Tap style={styles.outline} onPress={() => Linking.openURL(item.url).catch(() => toast.error("Couldn't open iBay. Please try again."))} scaleTo={0.97}>
            <ExternalLink size={17} color={colors.text} />
            <Text style={styles.outlineText}>See it on iBay</Text>
          </Tap>

          {/* Claiming works by matching the seller's phone number: only with phone sign-in. */}
          {(phoneSignIn || item.isMine) && (
          <View style={styles.card}>
            <View style={styles.sellerRow}>
              <Store size={18} color={colors.primary} />
              <Text style={styles.heading}>Is this your item?</Text>
            </View>
            {item.isMine ? (
              <>
                <Text style={styles.description}>Move it to Alibe and get chat, offers and reviews for free. Your photos and details come with it.</Text>
                <Tap style={styles.primary} onPress={() => claim()} disabled={claiming} scaleTo={0.97}>
                  {claiming ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Move it to Alibe</Text>}
                </Tap>
                <Tap style={styles.link} onPress={confirmRemove}>
                  <Text style={styles.linkText}>Remove it from Alibe</Text>
                </Tap>
              </>
            ) : (
              <>
                <Text style={styles.description}>Sign in with the phone number on this listing, and you can move it to Alibe or remove it from here.</Text>
                {item.myPhoneMissing && phoneSignIn && (
                  <Tap style={styles.link} onPress={() => navigation.navigate("ChangePhone")}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>Add my phone number</Text>
                  </Tap>
                )}
              </>
            )}
          </View>
          )}

          <Tap style={styles.link} onPress={confirmReport}>
            <Text style={styles.linkText}>Report this item</Text>
          </Tap>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", paddingBottom: spacing.xl },
  price: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.5 },
  priceNote: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.xs },
  meta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  warning: { flexDirection: "row", gap: spacing.sm + 2, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.card },
  warningTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  warningText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, lineHeight: fontSize.sm * 1.4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  description: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, lineHeight: fontSize.md * 1.4 },
  outline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: controlHeight.secondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  outlineText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  primary: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  buyNote: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: -spacing.sm },
  link: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.xs },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
