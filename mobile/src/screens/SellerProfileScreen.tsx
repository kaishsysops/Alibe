import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PackageOpen, UserX } from "lucide-react-native";
import { api, Listing, PublicUser } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import { ContactIconButtons, hasContactOptions } from "../components/ContactButtons";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import TrustBadge from "../components/TrustBadge";

export default function SellerProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isDesktopWeb, gutter, contentWidth } = useResponsive();
  const { id } = route.params;
  const [seller, setSeller] = useState<PublicUser | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([api.user(id), api.myListings(id, "ACTIVE")])
      .then(([u, l]) => {
        setSeller(u);
        setListings(l);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [id]);

  const goToProduct = (l: Listing) => navigation.push("ProductDetail", { id: l.id });
  const memberSince = seller?.createdAt ? new Date(seller.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "";
  const isMe = user?.id === id;
  const pad = isDesktopWeb ? 0 : gutter;

  const header = loading ? (
    <SkeletonGroup>
      <View style={[styles.card, { marginHorizontal: pad }]}>
        <Skeleton width={64} height={64} rounded={32} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="50%" height={18} />
          <Skeleton width="80%" height={12} />
        </View>
      </View>
    </SkeletonGroup>
  ) : seller ? (
    <View style={{ paddingHorizontal: pad }}>
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: seller.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarText}>{seller.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{seller.name}</Text>
          <Text style={styles.meta}>
            {seller.username ? `@${seller.username}  ·  ` : ""}Since {memberSince}
          </Text>
          <TrustBadge userId={seller.id} />
          {!!seller.bio && <Text style={styles.bio}>{seller.bio}</Text>}
        </View>
      </View>
      {!isMe && hasContactOptions(seller) && (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Contact</Text>
          <ContactIconButtons contact={seller} size={44} />
        </View>
      )}
      <Text style={styles.sectionTitle}>
        {seller.activeListingsCount} listing{seller.activeListingsCount === 1 ? "" : "s"} for sale
      </Text>
    </View>
  ) : null;

  const body = missing ? (
    <EmptyState icon={UserX} title="Seller not found" message="This account may have been deleted." actionLabel="Back to browsing" onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })} />
  ) : (
    <ProductGrid
      data={listings}
      loading={loading}
      onPressItem={goToProduct}
      containerWidth={isDesktopWeb ? contentWidth : undefined}
      horizontalPadding={pad}
      bottomPadding={spacing.xl}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState icon={PackageOpen} compact title="Nothing for sale right now" message="Check back later for new items from this seller." />}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>{body}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={seller?.name} />
      {body}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.lg, flex: 1 },
  card: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, padding: spacing.md, marginTop: spacing.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.xxl },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  bio: { color: colors.text, fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: fontSize.sm * 1.45 },
  contactRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, paddingLeft: spacing.md, ...cardShadow },
  contactLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
}));
