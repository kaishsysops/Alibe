import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { ClipboardCheck, MapPin, User } from "lucide-react-native";
import { api, errorMessage, mediaUrl, PendingPost } from "../api/client";
import { useToast } from "../components/Toast";
import { useConsole } from "../components/ConsoleContext";
import EmptyState from "../components/EmptyState";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";
import { timeAgo } from "../utils/time";
import { useConsolePage } from "./layout";

// Post approvers: items from sellers who aren't verified, oldest first. One
// tap approves; turning down needs a reason the seller sees.
const REASONS = ["This item isn't allowed on Alibe", "Wrong category", "The photos don't show the item", "The description is misleading", "Looks like a business: please register as a store"];

export default function PostsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { refresh } = useConsole();
  const page = useConsolePage();
  const [posts, setPosts] = useState<PendingPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setPosts(await api.staffPosts());
    } catch (e) {
      toast.error(errorMessage(e));
      setPosts((x) => x ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const decide = async (p: PendingPost, approve: boolean) => {
    if (!approve && reason.trim().length < 3) return toast.error("Say why, in a sentence. The seller sees it.");
    setBusy(p.id);
    try {
      await api.decidePost(p.id, approve, approve ? undefined : reason.trim());
      setPosts((list) => list?.filter((x) => x.id !== p.id) ?? list);
      setRejecting(null);
      setReason("");
      toast.success(approve ? "Live now." : "Turned down. The seller has been told why.");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!posts) return <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />;

  return (
    <ScrollView contentContainerStyle={[styles.list, page]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} />}>
      {posts.length === 0 && <EmptyState icon={ClipboardCheck} title="Nothing to approve" message="Posts from sellers who aren't verified show up here." />}
      {posts.map((p) => (
        <View key={p.id} style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {(p.images.length ? p.images : [null]).map((img, i) =>
              img ? <Image key={i} source={{ uri: mediaUrl(img) }} style={styles.photo} contentFit="cover" /> : <View key={i} style={[styles.photo, styles.noPhoto]}><Text style={styles.meta}>No photos</Text></View>
            )}
          </ScrollView>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{p.title}</Text>
              <Text style={styles.price}>MVR {p.price.toLocaleString()}</Text>
            </View>
            <Text style={styles.meta}>
              {p.category?.name} · {p.condition.replace("_", " ").toLowerCase()} · sent {timeAgo(p.createdAt, true)}
            </Text>
            <Text style={styles.description} numberOfLines={6}>
              {p.description}
            </Text>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <User size={13} color={colors.textMuted} />
                <Text style={styles.meta}>
                  {p.seller.name}
                  {p.sellerEmail ? ` (${p.sellerEmail})` : ""} · {p.sellerPublishedCount} {p.sellerPublishedCount === 1 ? "post" : "posts"} approved before
                </Text>
              </View>
              {!!p.island?.name && (
                <View style={styles.fact}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={styles.meta}>
                    {p.island.name}
                    {p.island.atoll ? `, ${p.island.atoll.name}` : ""}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {rejecting === p.id ? (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.reasons}>
                {REASONS.map((r) => (
                  <Tap key={r} style={[styles.reasonChip, reason === r && styles.reasonChipOn]} onPress={() => setReason(r)} scaleTo={0.96}>
                    <Text style={[styles.reasonText, reason === r && { color: colors.inverseText }]}>{r}</Text>
                  </Tap>
                ))}
              </View>
              <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Why it's turned down (the seller sees this)" placeholderTextColor={colors.textMuted} maxLength={300} />
              <View style={styles.actions}>
                <Tap style={[styles.button, styles.secondary]} onPress={() => (setRejecting(null), setReason(""))} scaleTo={0.97}>
                  <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
                </Tap>
                <Tap style={[styles.button, { backgroundColor: colors.danger }]} onPress={() => decide(p, false)} disabled={busy === p.id} scaleTo={0.97}>
                  {busy === p.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Turn down</Text>}
                </Tap>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Tap style={[styles.button, styles.secondary]} onPress={() => (setRejecting(p.id), setReason(""))} scaleTo={0.97}>
                <Text style={[styles.buttonText, { color: colors.danger }]}>Turn down</Text>
              </Tap>
              <Tap style={[styles.button, { backgroundColor: colors.success }]} onPress={() => decide(p, true)} disabled={busy === p.id} scaleTo={0.97}>
                {busy === p.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Approve</Text>}
              </Tap>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { paddingVertical: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, ...cardShadow },
  photo: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.background },
  noPhoto: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  body: { gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.primary },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  description: { fontSize: fontSize.base, lineHeight: 21, color: colors.text, marginTop: 4 },
  facts: { gap: 4, marginTop: 4 },
  fact: { flexDirection: "row", alignItems: "center", gap: 6 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: { paddingHorizontal: 12, height: 32, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  reasonChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  reasonText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "flex-end" },
  button: { flexGrow: 1, maxWidth: 220, minWidth: 120, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
}));
