import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLinkTo, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Moon, Star, Flag, PartyPopper, Info, CheckCircle2, AlertTriangle, Sparkles, X, ArrowRight, LucideIcon } from "lucide-react-native";
import { Banner, mediaUrl, SeasonTheme } from "../api/client";
import { useSite } from "../api/SiteContext";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";

// Seasonal looks admins switch on by date (Admin > Promotions > Season).
export const SEASON_LOOK: Record<SeasonTheme, { Icon: LucideIcon; color: string; greeting: string; name: string }> = {
  RAMADAN: { Icon: Moon, color: "#C9A227", greeting: "Ramadan Mubarak", name: "Ramadan" },
  EID: { Icon: Star, color: "#2E9D6E", greeting: "Eid Mubarak", name: "Eid" },
  INDEPENDENCE: { Icon: Flag, color: "#D21034", greeting: "Happy Independence Day", name: "Independence Day" },
  NEW_YEAR: { Icon: PartyPopper, color: "#7B5CF5", greeting: "Happy New Year", name: "New Year" },
};

// A small seasonal mark that sits next to the Alibe logo (nothing when no season is on).
export function SeasonalMark({ size = 16 }: { size?: number }) {
  const { season } = useSite();
  if (!season) return null;
  const look = SEASON_LOOK[season.theme];
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: `${look.color}22`, alignItems: "center", justifyContent: "center" }} accessibilityLabel={look.name}>
      <look.Icon size={size} color={look.color} fill={season.theme === "RAMADAN" || season.theme === "EID" ? look.color : "transparent"} />
    </View>
  );
}

// "Ramadan Mubarak" style greeting chip (Home).
export function SeasonalGreeting({ style }: { style?: object }) {
  const styles = useStyles();
  const { season } = useSite();
  if (!season) return null;
  const look = SEASON_LOOK[season.theme];
  return (
    <View style={[styles.greeting, { backgroundColor: `${look.color}1C`, borderColor: `${look.color}55` }, style]}>
      <look.Icon size={15} color={look.color} fill={season.theme === "RAMADAN" || season.theme === "EID" ? look.color : "transparent"} />
      <Text style={[styles.greetingText, { color: look.color }]}>{season.greeting || look.greeting}</Text>
    </View>
  );
}

const TONE = { INFO: Info, SUCCESS: CheckCircle2, WARNING: AlertTriangle, CELEBRATE: Sparkles } as const;

// Admin banners for this part of the app: Home shows everyone + buyers,
// seller screens show everyone + sellers. Each can be closed (remembered).
export function SiteBanners({ place, style }: { place: "home" | "seller"; style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { banners } = useSite();
  const linkTo = useLinkTo();
  const [closed, setClosed] = useState<string[] | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("alibe.closedBanners")
      .then((v) => setClosed(v ? JSON.parse(v) : []))
      .catch(() => setClosed([]));
  }, []);
  if (!closed) return null;
  const shown = banners.filter((b) => !closed.includes(b.id) && (b.audience === "EVERYONE" || (place === "home" ? b.audience === "BUYERS" : b.audience === "SELLERS")));
  if (!shown.length) return null;
  const close = (b: Banner) => {
    const next = [...closed, b.id].slice(-50);
    setClosed(next);
    AsyncStorage.setItem("alibe.closedBanners", JSON.stringify(next)).catch(() => {});
  };
  const tint = (t: Banner["tone"]) => (t === "SUCCESS" ? colors.success : t === "WARNING" ? colors.gold : t === "CELEBRATE" ? colors.primary : colors.verified);
  const open = (link: string) => {
    if (link.startsWith("/")) linkTo(link);
    else if (typeof window !== "undefined") window.open(link, "_blank", "noopener");
  };
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {shown.map((b) => {
        const Icon = TONE[b.tone];
        const c = tint(b.tone);
        return (
          <View key={b.id} style={[styles.banner, { backgroundColor: `${c}14`, borderColor: `${c}44` }]} accessibilityRole="alert">
            <Icon size={18} color={c} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bannerText}>{b.message}</Text>
              {!!b.link && (
                <Tap onPress={() => open(b.link!)} scaleTo={0.97} style={styles.bannerLink}>
                  <Text style={[styles.bannerLinkText, { color: c }]}>{b.linkLabel || "Learn more"}</Text>
                  <ArrowRight size={13} color={c} />
                </Tap>
              )}
            </View>
            <Tap onPress={() => close(b)} hitSlop={10} scaleTo={0.9} accessibilityLabel="Close">
              <X size={16} color={colors.textMuted} />
            </Tap>
          </View>
        );
      })}
    </View>
  );
}

// Running events as cards on Home ("Eid sale: shop now").
export function EventCards({ style }: { style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { events, season } = useSite();
  const navigation = useNavigation<any>();
  if (!events.length) return null;
  const accent = season ? SEASON_LOOK[season.theme].color : colors.primary;
  return (
    <View style={[{ gap: spacing.sm + 4 }, style]}>
      {events.map((e) => (
        <Tap
          key={e.id}
          style={[styles.event, { backgroundColor: accent }]}
          onPress={() => navigation.navigate("Tabs", { screen: "SearchTab", params: { ...(e.searchText ? { q: e.searchText } : {}), ...(e.categorySlug ? { categorySlug: e.categorySlug } : {}) } })}
          scaleTo={0.98}
          accessibilityLabel={`${e.title}. Shop now`}
        >
          {e.image && <Image source={{ uri: mediaUrl(e.image) }} style={styles.eventImage} contentFit="cover" />}
          <View style={styles.eventShade} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eventKicker}>On now · until {new Date(`${e.endsOn}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>
            <Text style={styles.eventTitle}>{e.title}</Text>
            {!!e.subtitle && <Text style={styles.eventSub}>{e.subtitle}</Text>}
          </View>
          <View style={styles.eventCta}>
            <Text style={[styles.eventCtaText, { color: accent }]}>Shop now</Text>
            <ArrowRight size={16} color={accent} />
          </View>
        </Tap>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  greeting: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1 },
  greetingText: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: 19 },
  bannerLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  bannerLinkText: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  event: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md + 4, borderRadius: radius.lg, overflow: "hidden", minHeight: 110, ...cardShadow },
  eventImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  eventShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.28)" },
  eventKicker: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: 0.6 },
  eventTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#fff" },
  eventSub: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.92)", lineHeight: 19 },
  eventCta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: "#fff" },
  eventCtaText: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
}));
