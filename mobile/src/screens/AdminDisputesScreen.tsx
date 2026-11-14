import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Linking } from "react-native";
import { Scale, ChevronDown, ChevronUp, Ship } from "lucide-react-native";
import { api, AdminDispute, errorMessage, mediaUrl } from "../api/client";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { RowSkeleton } from "../components/Skeleton";
import DisputePanel from "../components/DisputePanel";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

// Staff only: open disputes, oldest first. Open one to read both sides'
// evidence and settle it.
export default function AdminDisputesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { isDesktopWeb, gutter } = useResponsive();
  const [disputes, setDisputes] = useState<AdminDispute[] | null>(null);
  const [openId, setOpenId] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDisputes(await api.adminDisputes());
    } catch (e) {
      setDisputes((d) => d ?? []);
      toast.error(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Disputes" />}
      {!disputes ? (
        <View style={{ padding: gutter }}>
          <RowSkeleton count={4} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}>
          {disputes.length === 0 && <EmptyState icon={Scale} title="No open disputes" message="When a buyer reports a problem with an order, it shows up here." />}
          {disputes.map((d) => {
            const open = openId === d.id;
            return (
              <View key={d.id} style={styles.card}>
                <Tap style={styles.row} onPress={() => setOpenId(open ? undefined : d.id)} scaleTo={0.99}>
                  <ListingImage uri={d.listing.images[0]} style={styles.thumb} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {d.listing.title}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      MVR {d.amount.toLocaleString()} · {d.buyer.name} bought from {d.seller.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={2}>
                      {d.problem ?? "No details"} · {d.evidenceCount} {d.evidenceCount === 1 ? "reply" : "replies"} · {timeAgo(d.updatedAt, true)}
                    </Text>
                  </View>
                  {open ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
                </Tap>
                {open && (
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {!!d.cargoReceiptUrl && (
                      <Tap style={styles.receipt} onPress={() => Linking.openURL(mediaUrl(d.cargoReceiptUrl) ?? "").catch(() => {})} scaleTo={0.98}>
                        <Ship size={16} color={colors.primary} />
                        <Text style={styles.receiptText}>Open the seller's cargo receipt</Text>
                      </Tap>
                    )}
                    <DisputePanel orderId={d.id} staff onSettled={() => (setOpenId(undefined), load())} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, gap: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 2, ...cardShadow },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  receipt: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  receiptText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
