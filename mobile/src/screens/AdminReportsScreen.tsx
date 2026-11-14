import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle2, EyeOff } from "lucide-react-native";
import { api, errorMessage, ReportAction, ReportGroup, ReportReason } from "../api/client";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { RowSkeleton } from "../components/Skeleton";
import { animateLayout, FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

const REASONS: Record<ReportReason, string> = {
  SCAM: "Scam",
  PROHIBITED: "Prohibited item",
  WRONG_CATEGORY: "Wrong category",
  OFFENSIVE: "Offensive",
  OTHER: "Other",
};

export default function AdminReportsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { isDesktopWeb, gutter } = useResponsive();
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api.adminReports().then(setGroups).catch((e) => toast.error(errorMessage(e))), [toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Optimistic: the card leaves at once and comes back if the server refuses.
  const resolve = async (group: ReportGroup, action: ReportAction, done: string) => {
    const before = groups;
    animateLayout();
    setGroups((g) => g?.filter((x) => x.key !== group.key) ?? g);
    try {
      await api.resolveReports(group.listing ? { listingId: group.listing.id } : { reportedUserId: group.user!.id }, action);
      toast.success(done);
    } catch (e) {
      animateLayout();
      setGroups(before);
      toast.error(errorMessage(e));
    }
  };

  const confirmBan = (group: ReportGroup) =>
    showAlert({
      title: `Ban ${group.user?.name ?? "this person"}?`,
      message: "All their listings come down, unsent orders are cancelled, and their phone and email can't be used on Alibe again.",
      kind: "error",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Ban", style: "destructive", onPress: () => resolve(group, "BAN", "Account banned.") }],
    });

  const confirmRemove = (group: ReportGroup) =>
    showAlert({
      title: "Remove this listing?",
      message: "It leaves Alibe and the seller is told it broke the rules.",
      kind: "info",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Remove", onPress: () => resolve(group, "REMOVE_LISTING", "Listing removed.") }],
    });

  const renderItem = ({ item, index }: { item: ReportGroup; index: number }) => (
    <FadeIn delay={Math.min(index, 6) * 50}>
      <View style={styles.card}>
        <View style={styles.top}>
          {item.listing && <ListingImage uri={item.listing.images[0]} style={styles.thumb} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>
              {item.listing ? item.listing.title : item.user?.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.listing ? `MVR ${item.listing.price.toLocaleString()} · by ${item.user?.name}` : "Reported account"}
            </Text>
            {!!item.listing?.hiddenAt && (
              <View style={styles.hiddenTag}>
                <EyeOff size={12} color={colors.gold} />
                <Text style={[styles.hiddenText, { color: colors.gold }]}>Hidden until you decide</Text>
              </View>
            )}
          </View>
          <View style={styles.count}>
            <Text style={styles.countNumber}>{item.reports.length}</Text>
            <Text style={styles.countLabel}>{item.reports.length === 1 ? "report" : "reports"}</Text>
          </View>
        </View>

        {item.reports.slice(0, 3).map((r) => (
          <Text key={r.id} style={styles.reason} numberOfLines={2}>
            <Text style={styles.reasonName}>{REASONS[r.reason]}</Text>
            {r.details ? `: ${r.details}` : ""} · {timeAgo(r.createdAt)}
          </Text>
        ))}

        <View style={styles.actions}>
          <Tap style={styles.action} onPress={() => resolve(item, "DISMISS", item.listing?.hiddenAt ? "Listing is back on Alibe." : "Report closed.")} scaleTo={0.95}>
            <Text style={styles.actionText}>Looks fine</Text>
          </Tap>
          {item.listing && (
            <Tap style={styles.action} onPress={() => confirmRemove(item)} scaleTo={0.95}>
              <Text style={styles.actionText}>Remove</Text>
            </Tap>
          )}
          <Tap style={[styles.action, { backgroundColor: colors.danger, borderColor: colors.danger }]} onPress={() => confirmBan(item)} scaleTo={0.95}>
            <Text style={[styles.actionText, { color: "#fff" }]}>Ban</Text>
          </Tap>
        </View>
      </View>
    </FadeIn>
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Reports to review" />}
      {!groups ? (
        <View style={{ paddingHorizontal: gutter }}>
          <RowSkeleton count={5} />
        </View>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={groups}
          keyExtractor={(g) => g.key}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} />}
          ListEmptyComponent={<EmptyState icon={CheckCircle2} title="Nothing to review" message="When someone reports a listing or an account, it appears here." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  top: { flexDirection: "row", gap: spacing.sm + 4, alignItems: "flex-start" },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  hiddenTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  hiddenText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  count: { alignItems: "center", minWidth: 48 },
  countNumber: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  countLabel: { fontSize: fontSize.caption, color: colors.textMuted },
  reason: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
  reasonName: { fontWeight: fontWeight.bold, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, height: controlHeight.secondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
}));
