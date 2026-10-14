import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ChevronRight, Package } from "lucide-react-native";
import { api, Order } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { ListingImage } from "./ListingCard";
import Tap from "./Tap";
import { FadeIn, Nudge } from "./Motion";

// Home-screen prompt for sellers with a sale waiting on them, so an accepted
// offer never sits unnoticed while the buyer waits.
export default function OrderNudge({ style }: { style?: any }) {
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [waiting, setWaiting] = useState<Order[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .orders(user.id, "SELLING")
        .then((orders) => setWaiting(orders.filter((o) => o.status === "AWAITING_DISPATCH" || o.status === "DISPATCHED")))
        .catch(() => {});
    }, [user])
  );

  if (!waiting.length) return null;
  const first = waiting[0];
  const toSend = waiting.filter((o) => o.status === "AWAITING_DISPATCH").length;
  const title =
    waiting.length > 1
      ? toSend
        ? `You have ${toSend} item${toSend > 1 ? "s" : ""} to send`
        : `${waiting.length} deliveries to finish`
      : first.status === "AWAITING_DISPATCH"
      ? `Send ${first.listing.title} to ${first.buyer.name}`
      : `Finish delivery to ${first.buyer.name}`;
  const sub =
    waiting.length > 1 ? "Buyers are waiting. Tap to see them." : first.status === "AWAITING_DISPATCH" ? "They're waiting for it. Tap to start." : "Ask them for their 4-digit code.";

  return (
    <FadeIn distance={-10} style={style}>
    <Tap
      style={styles.card}
      onPress={() => (waiting.length > 1 ? navigation.navigate("Orders", { tab: "SELLING" }) : navigation.navigate("OrderDetail", { id: first.id }))}
      scaleTo={0.98}
    >
      {waiting.length === 1 ? (
        <ListingImage uri={first.listing.images[0]} style={styles.thumb} />
      ) : (
        <View style={styles.iconWrap}>
          <Package size={24} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Nudge>
        <ChevronRight size={20} color="#fff" />
      </Nudge>
    </Tap>
    </FadeIn>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.primary },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)" },
  iconWrap: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#fff" },
  sub: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.85)", marginTop: 2 },
}));
