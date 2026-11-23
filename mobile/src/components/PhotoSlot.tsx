import React, { useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, LucideIcon, ImagePlus } from "lucide-react-native";
import { errorMessage, mediaUrl, uploadMedia } from "../api/client";
import { useToast } from "./Toast";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

// One photo to upload (ID front, selfie, store logo): a dashed box that
// becomes the picture once it's uploaded. Tap again to replace it.
export default function PhotoSlot({
  label,
  hint,
  value,
  onChange,
  Icon = ImagePlus,
  camera,
  square,
  style,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string) => void;
  Icon?: LucideIcon;
  // Offer the camera first (selfies), on phones.
  camera?: boolean;
  square?: boolean;
  // The slot's outer box; by default it shares a row with other slots.
  style?: object;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const pick = async () => {
    try {
      const useCamera = camera && Platform.OS !== "web";
      const perm = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return toast.error(useCamera ? "Allow camera access to take the photo." : "Allow photo access to choose a picture.");
      const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, ...(square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}) };
      const result = useCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      setBusy(true);
      setProgress(0);
      const asset = result.assets[0];
      const { url } = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg", setProgress);
      onChange(url);
    } catch (e) {
      toast.error(errorMessage(e, "That photo didn't upload. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[{ flexGrow: 1, flexBasis: 140, minWidth: 120, gap: 6 }, style]}>
      <Tap style={[styles.box, square && { aspectRatio: 1 }, !!value && styles.boxDone]} onPress={pick} disabled={busy} scaleTo={0.98} accessibilityLabel={value ? `Replace ${label}` : `Add ${label}`}>
        {value ? (
          <>
            <Image source={{ uri: mediaUrl(value) }} style={styles.image} contentFit="cover" />
            <View style={styles.done}>
              <Check size={13} color="#fff" strokeWidth={3} />
            </View>
          </>
        ) : busy ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hint}>{Math.round(progress * 100)}%</Text>
          </>
        ) : (
          <>
            <View style={styles.iconWrap}>{camera ? <Camera size={20} color={colors.primary} /> : <Icon size={20} color={colors.primary} />}</View>
            <Text style={styles.add}>{camera && Platform.OS !== "web" ? "Take photo" : "Add photo"}</Text>
          </>
        )}
      </Tap>
      <Text style={styles.label}>{label}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  box: { aspectRatio: 1.5, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 6, overflow: "hidden" },
  boxDone: { borderStyle: "solid", borderColor: colors.success },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  done: { position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  add: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 16 },
}));
