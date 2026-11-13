import React, { useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { Ship, Truck, Hand } from "lucide-react-native";
import { DeliveryOption, Island, Atoll } from "../api/client";
import { ATOLL_GEO, ISLAND_GEO } from "../data/maldives";
import MaldivesMap, { AtollDetailMap } from "./MaldivesMap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

// "Where it is" on a listing: the country with the atoll lit up, the atoll up
// close with the island pinned, and how the item can travel.
const MAP_HEIGHT = 128;

export default function ListingLocationCard({ island, deliveryOptions }: { island: Island & { atoll?: Atoll }; deliveryOptions?: DeliveryOption[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const code = island.atoll?.code;
  if (!code || !ATOLL_GEO[code]) return null;
  const pin = ISLAND_GEO[`${code}/${island.name}`] ?? { lat: ATOLL_GEO[code].lat, lng: ATOLL_GEO[code].lng };
  const options = deliveryOptions ?? [];
  const travel = options.includes("FERRY")
    ? { Icon: Ship, text: "Can be sent by ferry cargo to other islands" }
    : options.includes("COURIER")
    ? { Icon: Truck, text: `Courier delivery on ${island.name}` }
    : { Icon: Hand, text: `Pickup on ${island.name}` };
  const countryWidth = 70;

  return (
    <View style={styles.card} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <View style={styles.maps}>
          <MaldivesMap width={countryWidth} height={MAP_HEIGHT} thumbnail selected={code} pin={pin} />
          <AtollDetailMap width={width - countryWidth - spacing.sm - spacing.sm * 2} height={MAP_HEIGHT} code={code} islands={[{ id: island.id, name: island.name }]} selectedId={island.id} />
        </View>
      )}
      <View style={styles.textRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.island}>{island.name}</Text>
          <Text style={styles.atoll} numberOfLines={1}>
            {island.atoll?.name}
          </Text>
        </View>
      </View>
      <View style={styles.travel}>
        <travel.Icon size={15} color={colors.primary} />
        <Text style={styles.travelText}>{travel.text}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.sm, gap: spacing.sm },
  maps: { flexDirection: "row", gap: spacing.sm },
  textRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs },
  island: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  atoll: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
  travel: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  travelText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
}));
