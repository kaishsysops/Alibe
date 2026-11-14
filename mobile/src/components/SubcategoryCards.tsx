import React from "react";
import { ScrollView } from "react-native";
import { Category } from "../api/client";
import { CategoryTree } from "../utils/categoryTree";
import { categoryLook } from "../theme/categoryIcons";
import CategoryTile from "./CategoryTile";
import { FadeIn } from "./Motion";
import { spacing } from "../theme/theme";

const WIDTH = 132;
const HEIGHT = 96;

// A category's subcategories as a row of photo cards (a real photo from each,
// its count, and "+N" when it has more inside). Empty ones are left out.
export default function SubcategoryCards({ tree, slug, onPress, horizontalPadding = 0, large }: { tree: CategoryTree; slug: string; onPress: (c: Category) => void; horizontalPadding?: number; large?: boolean }) {
  const children = tree.childrenOf(slug).filter((c) => (c.listingCount ?? 0) > 0);
  if (!children.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: horizontalPadding, paddingVertical: spacing.xs }}
      keyboardShouldPersistTaps="handled"
    >
      {children.map((c, i) => {
        const { Icon, color } = categoryLook(c, tree);
        const inside = tree.childrenOf(c.slug).filter((k) => (k.listingCount ?? 0) > 0).length;
        return (
          <FadeIn key={c.id} delay={Math.min(i, 8) * 35}>
            <CategoryTile
              name={c.name}
              subtitle={`${(c.listingCount ?? 0).toLocaleString()}${inside ? "  ›" : ""}`}
              image={c.photo ?? undefined}
              Icon={Icon}
              color={color}
              size={large ? 180 : WIDTH}
              height={large ? 120 : HEIGHT}
              onPress={() => onPress(c)}
            />
          </FadeIn>
        );
      })}
    </ScrollView>
  );
}
