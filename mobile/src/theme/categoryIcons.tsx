import { Smartphone, Car, Sofa, Shirt, Home, Briefcase, Wrench, Leaf, ShoppingBag, HeartPulse, Trophy, Baby, BookOpen, Package, LucideIcon } from "lucide-react-native";

export const categoryIcons: Record<string, { Icon: LucideIcon; color: string }> = {
  electronics: { Icon: Smartphone, color: "#2E86DE" },
  vehicles: { Icon: Car, color: "#E74C3C" },
  furniture: { Icon: Sofa, color: "#8E5A3D" },
  fashion: { Icon: Shirt, color: "#D6336C" },
  property: { Icon: Home, color: "#0E9C7F" },
  jobs: { Icon: Briefcase, color: "#5B4FE9" },
  services: { Icon: Wrench, color: "#B8860B" },
  "home-garden": { Icon: Leaf, color: "#27AE60" },
  "health-beauty": { Icon: HeartPulse, color: "#E8590C" },
  "sports-hobbies": { Icon: Trophy, color: "#0B7285" },
  "baby-kids": { Icon: Baby, color: "#F06595" },
  "books-office": { Icon: BookOpen, color: "#6741D9" },
  other: { Icon: Package, color: "#6B7280" },
};

export const AllCategoriesIcon = ShoppingBag;
