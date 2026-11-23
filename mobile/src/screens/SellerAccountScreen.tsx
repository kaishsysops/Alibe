import React, { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { User, Store, Crown, Check, ChevronRight, Clock, Rocket, LayoutGrid, Sparkles, AlertTriangle, ExternalLink } from "lucide-react-native";
import { api, errorMessage, newClientId, SellerMe } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { SellerBadgePill, VerifiedBadge } from "../components/Badges";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

type Period = "MONTHLY" | "YEARLY";
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

// Profile > Seller account: what kind of seller you are, verification, your
// store, and the Store / Premium plans.
export default function SellerAccountScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { updateUser } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [me, setMe] = useState<SellerMe | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [buying, setBuying] = useState<string | null>(null);
  const clientId = useRef(newClientId());

  const load = useCallback(async () => {
    try {
      const m = await api.sellerMe();
      setMe(m);
      updateUser({ sellerKind: m.kind, ...(m.verified ? { verificationStatus: "VERIFIED" as const } : {}) });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const switchKind = (kind: "INDIVIDUAL" | "STORE") => {
    if (!me || me.kind === kind) return;
    if (kind === "STORE") return navigation.navigate("StoreApply");
    showAlert({
      title: "Sell as an individual?",
      message: "Only for personal items. Staff ban businesses that sell as individuals. Your store page closes while you're an individual.",
      kind: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            try {
              await api.setSellerKind("INDIVIDUAL");
              load();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          },
        },
      ],
    });
  };

  const buy = async (kind: "STORE_PLAN" | "PREMIUM_PLAN") => {
    setBuying(kind);
    try {
      await api.createPurchase({ kind, period }, `${clientId.current}-${kind}-${period}`);
      navigation.navigate("Purchases");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBuying(null);
    }
  };

  if (!me) {
    return (
      <View style={styles.container}>
        {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Seller account" />}
        <View style={[styles.scroll, { paddingHorizontal: gutter }]}>
          <SkeletonGroup>
            <Skeleton width="100%" height={130} rounded={radius.lg} />
            <Skeleton width="100%" height={90} rounded={radius.lg} style={{ marginTop: spacing.md }} />
            <Skeleton width="100%" height={260} rounded={radius.lg} style={{ marginTop: spacing.md }} />
          </SkeletonGroup>
        </View>
      </View>
    );
  }

  const isStore = me.kind === "STORE";
  const storeApproved = me.store?.status === "APPROVED";
  const yearly = period === "YEARLY";
  const storePrice = yearly ? me.prices.storeYearly : me.prices.storeMonthly;
  const premiumPrice = yearly ? me.prices.premiumYearly : me.prices.premiumMonthly;
  const per = yearly ? "year" : "month";
  const saving = (m: number, y: number) => Math.max(0, Math.round(100 - (y / (m * 12)) * 100));
  const badge = me.premium ? "PREMIUM" : me.storeLive ? "STORE" : me.verified ? "VERIFIED" : null;
  const limitUsed = me.monthlyLimit ? Math.min(1, me.postedThisMonth / me.monthlyLimit) : 0;

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Seller account" />}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}
      >
        {/* Standing */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Selling as</Text>
              <Text style={styles.heroTitle}>{isStore ? (me.store?.name ?? "A store") : "An individual"}</Text>
            </View>
            {badge ? <SellerBadgePill badge={badge} /> : <Text style={styles.unverified}>Not verified</Text>}
          </View>
          {me.monthlyLimit ? (
            <View style={{ gap: 6 }}>
              <View style={styles.limitRow}>
                <Text style={styles.limitText}>
                  {me.postedThisMonth} of {me.monthlyLimit} posts this month
                </Text>
                <Text style={styles.limitHint}>Resets on the 1st</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${limitUsed * 100}%`, backgroundColor: limitUsed >= 1 ? colors.danger : colors.primary }]} />
              </View>
            </View>
          ) : (
            <View style={styles.perkRow}>
              <Check size={15} color={colors.success} strokeWidth={3} />
              <Text style={styles.perkInline}>No monthly post limit</Text>
            </View>
          )}
          <View style={styles.perkRow}>
            {me.nextPostReviewed ? <Clock size={15} color={colors.primary} /> : <Check size={15} color={colors.success} strokeWidth={3} />}
            <Text style={styles.perkInline}>
              {me.approved
                ? "Your posts go live straight away"
                : me.freePostsLeft
                  ? `Next ${me.freePostsLeft} ${me.freePostsLeft === 1 ? "post goes" : "posts go"} live straight away; after that they're checked first`
                  : "New posts are checked by our team first (get verified to skip this)"}
            </Text>
          </View>
        </View>

        {/* Individual / Store */}
        <View style={styles.kindRow}>
          {(
            [
              ["INDIVIDUAL", "Individual", "Personal items", User],
              ["STORE", "Store", "Business · paid plan", Store],
            ] as const
          ).map(([k, label, sub, Icon]) => {
            const on = me.kind === k;
            return (
              <Tap key={k} style={[styles.kind, on && styles.kindOn]} onPress={() => switchKind(k)} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <Icon size={20} color={on ? colors.primary : colors.textMuted} />
                <Text style={[styles.kindLabel, on && { color: colors.primary }]}>{label}</Text>
                <Text style={styles.kindSub}>{sub}</Text>
              </Tap>
            );
          })}
        </View>
        {!isStore && (
          <View style={styles.note}>
            <AlertTriangle size={15} color={colors.gold} />
            <Text style={styles.noteText}>Selling for a business? Register as a store. Staff ban shops that sell as individuals.</Text>
          </View>
        )}

        {/* Verification / store status */}
        {!isStore ? (
          <Tap style={styles.row} onPress={() => navigation.navigate("Verify")} scaleTo={0.98}>
            <View style={[styles.rowIcon, { backgroundColor: `${colors.verified}1A` }]}>
              <VerifiedBadge size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{me.verified ? "Verified" : me.verifyApplication?.status === "PENDING" ? "ID being checked" : "Get verified"}</Text>
              <Text style={styles.rowText}>
                {me.verified
                  ? "Your ID is checked. Thanks!"
                  : me.verifyApplication?.status === "PENDING"
                    ? "We'll tell you once it's done."
                    : me.verifyApplication?.status === "REJECTED"
                      ? `Not approved: ${me.verifyApplication.note ?? ""} Tap to try again.`
                      : "Optional. Your posts skip the review after your first 5."}
              </Text>
            </View>
            {me.verifyApplication?.status === "PENDING" ? <Clock size={18} color={colors.primary} /> : <ChevronRight size={18} color={colors.textMuted} />}
          </Tap>
        ) : (
          <Tap style={styles.row} onPress={() => (me.storeLive && me.store ? navigation.navigate("Store", { slug: me.store.slug }) : navigation.navigate("StoreApply"))} scaleTo={0.98}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primaryTint }]}>
              <Store size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{me.storeLive ? "Your store page" : storeApproved ? "Store approved" : me.store?.status === "PENDING" ? "Store being checked" : me.store?.status === "REJECTED" ? "Store not approved" : "Finish your store application"}</Text>
              <Text style={styles.rowText}>
                {me.storeLive
                  ? `alibe.online/store/${me.store!.slug} · plan until ${date(me.storeEndsAt)}`
                  : storeApproved
                    ? "Choose a Store plan below to open your page."
                    : me.store?.status === "PENDING"
                      ? "We'll tell you once it's done."
                      : me.store?.rejectReason
                        ? `${me.store.rejectReason} Tap to fix and resend.`
                        : "Business name, logo, registration and ID."}
              </Text>
            </View>
            {me.storeLive ? <ExternalLink size={17} color={colors.textMuted} /> : <ChevronRight size={18} color={colors.textMuted} />}
          </Tap>
        )}

        {/* Plans */}
        <View style={styles.plansHead}>
          <Text style={styles.section}>Plans</Text>
          <View style={styles.toggle}>
            {(["MONTHLY", "YEARLY"] as const).map((p) => (
              <Tap key={p} style={[styles.toggleOption, period === p && styles.toggleOn]} onPress={() => setPeriod(p)} scaleTo={0.96}>
                <Text style={[styles.toggleText, period === p && styles.toggleTextOn]}>{p === "MONTHLY" ? "Monthly" : "Yearly"}</Text>
              </Tap>
            ))}
          </View>
        </View>

        {isStore && (
          <PlanCard
            Icon={Store}
            tint={colors.primary}
            name="Store"
            price={storePrice}
            per={per}
            save={yearly ? saving(me.prices.storeMonthly, me.prices.storeYearly) : 0}
            perks={["Your own store page with your logo", "Store badge on every item", "Shown above individual sellers"]}
            activeUntil={me.storeLive ? date(me.storeEndsAt) : null}
            locked={!storeApproved ? "Needs an approved store" : null}
            busy={buying === "STORE_PLAN"}
            onBuy={() => buy("STORE_PLAN")}
          />
        )}
        <PlanCard
          Icon={Crown}
          tint={colors.gold}
          name="Premium"
          price={premiumPrice}
          per={per}
          save={yearly ? saving(me.prices.premiumMonthly, me.prices.premiumYearly) : 0}
          perks={[`${me.premiumFreeBoosts} free 7-day boosts every month`, "Your new items featured at the top for a week", "Gold Premium badge"]}
          activeUntil={me.premium ? date(me.premiumEndsAt) : null}
          locked={!me.approved ? (isStore ? "Needs an approved store" : "Get verified first") : null}
          busy={buying === "PREMIUM_PLAN"}
          onBuy={() => buy("PREMIUM_PLAN")}
          extra={me.premium ? `${me.freeBoosts.left} of ${me.freeBoosts.allowance} free boosts left this month` : isStore ? "Stores pay for Premium on top of the Store plan." : null}
        />

        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>How selling on Alibe works</Text>
          {[
            ["1", "Your first 5 posts go live straight away."],
            ["2", "After that, our team checks each new post before it goes live, usually within a few hours. Verified sellers and approved stores skip this."],
            ["3", "Getting verified is free and optional: send photos of both sides of your ID card, and it also unlocks boosts and the blue tick."],
            ["4", "Up to 30 new posts a month. Premium and Store plans have no limit."],
            ["5", "Businesses must sell as a store (a paid plan). Staff ban shops posing as individuals."],
          ].map(([n, text]) => (
            <View key={n} style={styles.rule}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{n}</Text>
              </View>
              <Text style={styles.ruleText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Sparkles size={14} color={colors.textMuted} />
          <Text style={styles.footerText}>Plans start once we've confirmed your bank transfer. Renewing early adds to the time you have left.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  Icon,
  tint,
  name,
  price,
  per,
  save,
  perks,
  activeUntil,
  locked,
  busy,
  onBuy,
  extra,
}: {
  Icon: typeof Crown;
  tint: string;
  name: string;
  price: number;
  per: string;
  save: number;
  perks: string[];
  activeUntil: string | null;
  locked: string | null;
  busy: boolean;
  onBuy: () => void;
  extra?: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.plan, activeUntil && { borderColor: tint }]}>
      <View style={styles.planHead}>
        <View style={[styles.planIcon, { backgroundColor: `${tint}1F` }]}>
          <Icon size={20} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{name}</Text>
          {activeUntil ? <Text style={[styles.planActive, { color: colors.success }]}>Active until {activeUntil}</Text> : save > 0 ? <Text style={[styles.planActive, { color: tint }]}>Save {save}% yearly</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.planPrice}>MVR {price.toLocaleString()}</Text>
          <Text style={styles.planPer}>a {per}</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {perks.map((p) => (
          <View key={p} style={styles.perkRow}>
            <View style={[styles.perkDot, { backgroundColor: `${tint}22` }]}>
              <Check size={11} color={tint} strokeWidth={3.2} />
            </View>
            <Text style={styles.perkInline}>{p}</Text>
          </View>
        ))}
      </View>
      {!!extra && <Text style={styles.planExtra}>{extra}</Text>}
      {locked ? (
        <View style={styles.locked}>
          <Text style={styles.lockedText}>{locked}</Text>
        </View>
      ) : (
        <Tap style={[styles.planButton, { backgroundColor: tint }]} onPress={onBuy} disabled={busy} scaleTo={0.97}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.planButtonText}>{activeUntil ? "Renew" : `Get ${name}`}</Text>}
        </Tap>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, width: "100%", maxWidth: contentWidth.form, alignSelf: "center", flexGrow: 1, justifyContent: "center" },
  hero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, ...cardShadow },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 2 },
  unverified: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.background },
  limitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  limitText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  limitHint: { fontSize: fontSize.caption, color: colors.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  kindRow: { flexDirection: "row", gap: spacing.sm + 4 },
  kind: { flex: 1, padding: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, gap: 4 },
  kindOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  kindLabel: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 4 },
  kindSub: { fontSize: fontSize.caption, color: colors.textMuted },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs, marginTop: -4 },
  noteText: { flex: 1, fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  rowText: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  plansHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  section: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  toggle: { flexDirection: "row", padding: 3, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  toggleOption: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.text },
  toggleText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  toggleTextOn: { color: colors.inverseText },
  plan: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, borderWidth: 2, borderColor: "transparent", ...cardShadow },
  planHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  planIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  planActive: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, marginTop: 2 },
  planPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  planPer: { fontSize: fontSize.caption, color: colors.textMuted },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  perkDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  perkInline: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  planExtra: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  planButton: { height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  planButtonText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.base },
  locked: { height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  lockedText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  rules: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm + 2, ...cardShadow },
  rulesTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: 2 },
  rule: { flexDirection: "row", gap: spacing.sm + 2, alignItems: "flex-start" },
  ruleNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", marginTop: 1 },
  ruleNumText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.primary },
  ruleText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  footer: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xs },
  footerText: { flex: 1, fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 17 },
}));
