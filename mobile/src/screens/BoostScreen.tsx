import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api, errorMessage, MoneyConfig, newClientId } from "../api/client";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import PlanPicker from "../components/PlanPicker";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";

export default function BoostScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { isDesktopWeb } = useResponsive();
  const [config, setConfig] = useState<MoneyConfig | null>(null);
  const [days, setDays] = useState(7);
  const clientId = useRef(newClientId());

  useEffect(() => {
    api.moneyConfig().then(setConfig).catch((e) => toast.error(errorMessage(e)));
  }, [toast]);

  const [buy, buying] = useSingleFlight(async () => {
    try {
      await api.createPurchase({ kind: "BOOST", listingId: route.params.id, days }, `${clientId.current}-${days}`);
      navigation.replace("Purchases");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Boost this item" />}
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Get seen first</Text>
        <Text style={styles.text}>Your item appears at the top of its category and matching searches, with a "Featured" label. It starts once we've confirmed your payment.</Text>
        {config ? (
          <PlanPicker prices={config.boostPrices} days={days} onChange={setDays} />
        ) : (
          <SkeletonGroup>
            <Skeleton width="100%" height={76} rounded={radius.lg} />
          </SkeletonGroup>
        )}
        <Tap style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => buy()} disabled={buying || !config} scaleTo={0.97}>
          {buying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue to payment</Text>}
        </Tap>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, width: "100%", maxWidth: contentWidth.form, alignSelf: "center" },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text },
  text: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: fontSize.md * 1.4 },
  button: { height: controlHeight.primary, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
}));
