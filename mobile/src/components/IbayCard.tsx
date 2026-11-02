import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { IbayItemSummary } from "../api/client";
import { ListingImage } from "./ListingCard";
import Tap from "./Tap";
import PhotoBadge from "./PhotoBadge";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

export const ibayPrice = (item: Pick<IbayItemSummary, "price" | "currency">) => (item.price ? `${item.currency ?? "MVR"} ${item.price.toLocaleString()}` : "Ask the seller");

export default function IbayCard({ item, width }: { item: IbayItemSummary; width: number }) {
  const styles = useStyles();
  const navigation = useNavigation<any>();
  return (
    <Tap style={[styles.card, { width }]} onPress={() => navigation.navigate("IbayItem", { id: item.id })} scaleTo={0.97} accessibilityLabel={`${item.title}, from iBay`}>
      <View style={styles.imageWrap}>
        <ListingImage uri={item.imageUrl ?? undefined} style={{ width, height: width }} />
        <PhotoBadge label="From iBay" />
      </View>
      <View style={styles.body}>
        <Text style={styles.price} numberOfLines={1}>
          {ibayPrice(item)}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </Tap>
  );
}

// Matches ListingCard, so iBay items look the same wherever they appear.
const useStyles = makeStyles((colors) => ({
  card: { marginBottom: spacing.md },
  imageWrap: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.skeleton },
  body: { paddingTop: spacing.sm, gap: 2 },
  price: { fontWeight: fontWeight.extrabold, color: colors.text, fontSize: fontSize.md },
  title: { color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.35 },
}));
