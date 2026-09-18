import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Camera } from "lucide-react-native";
import { api, Category, Atoll, Island } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { colors, spacing, radius, conditionColors } from "../theme/theme";
import { categoryIcons } from "../theme/categoryIcons";
import WebNavBar from "../components/WebNavBar";
import { useResponsive } from "../hooks/useResponsive";

const CONDITIONS: Array<"NEW" | "LIKE_NEW" | "GOOD" | "FAIR"> = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];
const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/newlisting/600/600";
const MAX_FORM_WIDTH = 640;

export default function SellScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isDesktopWeb } = useResponsive();
  const [categories, setCategories] = useState<Category[]>([]);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>("GOOD");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [islandId, setIslandId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.categories().then((c) => {
      setCategories(c);
      setCategoryId(c[0]?.id);
    });
    api.atolls().then((a) => {
      setAtolls(a);
      setIslandId(a[0]?.islands[0]?.id);
    });
  }, []);

  const islands: Island[] = atolls.flatMap((a) => a.islands);

  const publish = async () => {
    if (!user) return;
    if (!title || !price || !categoryId || !islandId) {
      Alert.alert("Missing info", "Please fill in title, price, category and island.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createListing({
        title,
        description: description || "No description provided.",
        price: Number(price),
        condition,
        categoryId,
        islandId,
        sellerId: user.id,
        images: [PLACEHOLDER_IMAGE],
      });
      setTitle("");
      setDescription("");
      setPrice("");
      Alert.alert("Published!", "Your listing is live.", [
        { text: "OK", onPress: () => navigation.navigate("HomeTab") },
      ]);
    } catch (e) {
      Alert.alert("Couldn't publish", String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <View style={{ width: "100%", maxWidth: isDesktopWeb ? MAX_FORM_WIDTH : undefined, alignSelf: isDesktopWeb ? "center" : undefined }}>
      <Text style={styles.header}>Sell an item</Text>

      <Image source={{ uri: PLACEHOLDER_IMAGE }} style={styles.photo} />
      <View style={styles.hintRow}>
        <Camera size={13} color={colors.textMuted} />
        <Text style={styles.hint}>Camera upload is a follow-up — using a placeholder photo for now.</Text>
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. iPhone 13 Pro 256GB" />

      <Text style={styles.label}>Price (MVR)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="0" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Condition details, reason for selling, etc."
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((c) => {
          const cat = categoryIcons[c.slug];
          const Icon = cat?.Icon;
          const active = categoryId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, active && { backgroundColor: cat?.color ?? colors.primary, borderColor: cat?.color ?? colors.primary }]}
              onPress={() => setCategoryId(c.id)}
            >
              {Icon && <Icon size={14} color={active ? "#fff" : colors.textMuted} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Condition</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {CONDITIONS.map((c) => {
          const active = condition === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, active && { backgroundColor: conditionColors[c], borderColor: conditionColors[c] }]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.replace("_", " ")}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Island</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {islands.map((i) => (
          <TouchableOpacity
            key={i.id}
            style={[styles.chip, islandId === i.id && styles.chipActive]}
            onPress={() => setIslandId(i.id)}
          >
            <Text style={[styles.chipText, islandId === i.id && styles.chipTextActive]}>{i.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.publishButton} onPress={publish} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishButtonText}>Publish listing</Text>}
      </TouchableOpacity>
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="sell" />
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>{form}</ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>{form}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  photo: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.border },
  hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.sm },
  hint: { fontSize: 11, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.card },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  publishButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  publishButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
