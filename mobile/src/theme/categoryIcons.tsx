import { Smartphone, Car, Sofa, Shirt, Home, Briefcase, Wrench, Leaf, ShoppingBag, LucideIcon } from "lucide-react-native";

export const categoryIcons: Record<string, { Icon: LucideIcon; color: string }> = {
  electronics: { Icon: Smartphone, color: "#2E86DE" },
  vehicles: { Icon: Car, color: "#E74C3C" },
  furniture: { Icon: Sofa, color: "#8E5A3D" },
  fashion: { Icon: Shirt, color: "#D6336C" },
  property: { Icon: Home, color: "#0E9C7F" },
  jobs: { Icon: Briefcase, color: "#5B4FE9" },
  services: { Icon: Wrench, color: "#B8860B" },
  "home-garden": { Icon: Leaf, color: "#27AE60" },
};

export const AllCategoriesIcon = ShoppingBag;
