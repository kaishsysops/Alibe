import React from "react";
import { Linking, Text, View } from "react-native";
import { Phone } from "lucide-react-native";
import { PublicSeller } from "../api/client";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { formatPhone, telUrl, viberUrl, whatsappUrl } from "../utils/phone";
import { WhatsAppIcon, ViberIcon, WHATSAPP_GREEN, VIBER_PURPLE } from "./BrandIcons";
import { useToast } from "./Toast";
import Tap from "./Tap";

type Contact = Pick<PublicSeller, "phone" | "whatsapp" | "viber">;

export function hasContactOptions(c: Contact) {
  return !!(c.phone || c.whatsapp || c.viber);
}

function useOpen() {
  const toast = useToast();
  return (url: string, appName: string) =>
    Linking.openURL(url).catch(() => toast.error(`Couldn't open ${appName}. Is it installed on this device?`));
}

// Full contact card for a listing / seller: the phone number plus one-tap
// Call, WhatsApp and Viber buttons (each only if the seller enabled it).
export function ContactCard({ contact, listingTitle }: { contact: Contact; listingTitle?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const open = useOpen();
  if (!hasContactOptions(contact)) return null;
  const greeting = listingTitle ? `Hi! I'm interested in "${listingTitle}" on Alibe. Is it still available?` : "Hi! I found you on Alibe.";

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Contact seller</Text>
      {contact.phone && (
        <Tap style={styles.phoneRow} onPress={() => open(telUrl(contact.phone!), "your phone app")} scaleTo={0.98}>
          <View style={[styles.phoneIcon, { backgroundColor: colors.primaryTint }]}>
            <Phone size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.phoneLabel}>Phone</Text>
            <Text style={styles.phoneNumber}>{formatPhone(contact.phone)}</Text>
          </View>
          <Text style={styles.callText}>Call</Text>
        </Tap>
      )}
      {(contact.whatsapp || contact.viber) && (
        <View style={styles.appRow}>
          {contact.whatsapp && (
            <Tap style={[styles.appButton, { backgroundColor: WHATSAPP_GREEN }]} onPress={() => open(whatsappUrl(contact.whatsapp!, greeting), "WhatsApp")}>
              <WhatsAppIcon size={18} color="#fff" />
              <Text style={styles.appButtonText}>WhatsApp</Text>
            </Tap>
          )}
          {contact.viber && (
            <Tap style={[styles.appButton, { backgroundColor: VIBER_PURPLE }]} onPress={() => open(viberUrl(contact.viber!), "Viber")}>
              <ViberIcon size={18} color="#fff" />
              <Text style={styles.appButtonText}>Viber</Text>
            </Tap>
          )}
        </View>
      )}
    </View>
  );
}

// Round icon-only buttons for tight spaces (sticky footer, chat header).
export function ContactIconButtons({ contact, listingTitle, size = 44 }: { contact: Contact; listingTitle?: string; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const open = useOpen();
  const greeting = listingTitle ? `Hi! I'm interested in "${listingTitle}" on Alibe. Is it still available?` : undefined;
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={styles.iconRow}>
      {contact.phone && (
        <Tap style={[styles.iconButton, circle, { backgroundColor: colors.primaryTint }]} onPress={() => open(telUrl(contact.phone!), "your phone app")} accessibilityLabel="Call seller" scaleTo={0.9}>
          <Phone size={size * 0.42} color={colors.primary} />
        </Tap>
      )}
      {contact.whatsapp && (
        <Tap style={[styles.iconButton, circle, { backgroundColor: "#E7F9EE" }]} onPress={() => open(whatsappUrl(contact.whatsapp!, greeting), "WhatsApp")} accessibilityLabel="Chat on WhatsApp" scaleTo={0.9}>
          <WhatsAppIcon size={size * 0.48} />
        </Tap>
      )}
      {contact.viber && (
        <Tap style={[styles.iconButton, circle, { backgroundColor: "#EFEDFE" }]} onPress={() => open(viberUrl(contact.viber!), "Viber")} accessibilityLabel="Chat on Viber" scaleTo={0.9}>
          <ViberIcon size={size * 0.48} />
        </Tap>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  heading: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 2 },
  phoneIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  phoneLabel: { fontSize: fontSize.caption, color: colors.textMuted },
  phoneNumber: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, letterSpacing: 0.3 },
  callText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary, paddingHorizontal: spacing.sm },
  appRow: { flexDirection: "row", gap: spacing.sm },
  appButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2, paddingVertical: spacing.sm + 4, borderRadius: radius.pill },
  appButtonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  iconRow: { flexDirection: "row", gap: spacing.sm },
  iconButton: { alignItems: "center", justifyContent: "center" },
}));
