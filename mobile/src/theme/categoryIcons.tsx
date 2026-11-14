import {
  Smartphone, Car, Sofa, Shirt, Home, Briefcase, Wrench, Leaf, ShoppingBag, HeartPulse, Trophy, Baby, BookOpen, Package, LucideIcon,
  PawPrint, Factory, Gamepad2, Headphones, Tv, Camera, Laptop, Tablet, Watch, Cpu, Cable, Bike, Truck, Ship, Fish, Building, Bed, Users, Hotel, Map,
  Store, CookingPot, WashingMachine, Fan, Utensils, Lamp, Frame, Bath, Sprout, Hammer, Apple, Scissors, Archive, Table, Armchair, Sun, Footprints,
  Gem, Glasses, GraduationCap, Dumbbell, LifeBuoy, Tent, Guitar, Dice5, Plane, Gift, Pen, Palette, Printer, Sparkles, PartyPopper, Monitor,
} from "lucide-react-native";
import { Category } from "../api/client";
import type { CategoryTree } from "../utils/categoryTree";

// Each top-level category's icon and colour. Subcategories take their branch's
// colour and their own icon (or their parent's).
export const categoryIcons: Record<string, { Icon: LucideIcon; color: string }> = {
  electronics: { Icon: Smartphone, color: "#2E86DE" },
  vehicles: { Icon: Car, color: "#E74C3C" },
  property: { Icon: Home, color: "#0E9C7F" },
  "home-garden": { Icon: Leaf, color: "#27AE60" },
  furniture: { Icon: Sofa, color: "#8E5A3D" },
  fashion: { Icon: Shirt, color: "#D6336C" },
  "health-beauty": { Icon: HeartPulse, color: "#E8590C" },
  "baby-kids": { Icon: Baby, color: "#F06595" },
  "sports-hobbies": { Icon: Trophy, color: "#0B7285" },
  "books-office": { Icon: BookOpen, color: "#6741D9" },
  pets: { Icon: PawPrint, color: "#C2410C" },
  business: { Icon: Factory, color: "#475569" },
  services: { Icon: Wrench, color: "#B8860B" },
  jobs: { Icon: Briefcase, color: "#5B4FE9" },
  other: { Icon: Package, color: "#6B7280" },
};

// Icon names used in the category tree (backend/src/categoryTree.ts) and by staff.
const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone, car: Car, sofa: Sofa, shirt: Shirt, home: Home, briefcase: Briefcase, wrench: Wrench, leaf: Leaf, "heart-pulse": HeartPulse,
  trophy: Trophy, baby: Baby, "book-open": BookOpen, package: Package, paw: PawPrint, factory: Factory, gamepad: Gamepad2, headphones: Headphones, tv: Tv,
  camera: Camera, laptop: Laptop, tablet: Tablet, watch: Watch, cpu: Cpu, cable: Cable, bike: Bike, bicycle: Bike, truck: Truck, ship: Ship, fish: Fish,
  building: Building, bed: Bed, users: Users, hotel: Hotel, map: Map, store: Store, "cooking-pot": CookingPot, "washing-machine": WashingMachine, fan: Fan,
  utensils: Utensils, lamp: Lamp, frame: Frame, bath: Bath, sprout: Sprout, hammer: Hammer, apple: Apple, scissors: Scissors, archive: Archive, table: Table,
  armchair: Armchair, sun: Sun, footprints: Footprints, "shopping-bag": ShoppingBag, gem: Gem, glasses: Glasses, graduation: GraduationCap, dumbbell: Dumbbell,
  waves: LifeBuoy, tent: Tent, music: Guitar, dice: Dice5, plane: Plane, gift: Gift, pen: Pen, palette: Palette, printer: Printer, sparkles: Sparkles,
  party: PartyPopper, monitor: Monitor,
};

export const AllCategoriesIcon = ShoppingBag;
const FALLBACK = { Icon: AllCategoriesIcon, color: "#FF6A00" };

// Icon and colour for any category at any depth.
export function categoryLook(category: Pick<Category, "slug" | "icon"> | undefined, tree?: CategoryTree): { Icon: LucideIcon; color: string } {
  if (!category) return FALLBACK;
  const path = tree ? tree.pathOf(category.slug) : [];
  const top = path[0] ?? category;
  const color = categoryIcons[top.slug]?.color ?? FALLBACK.color;
  // The nearest icon up the branch: its own, its parent's, ... the top's.
  for (const c of [category, ...path.slice(0, -1).reverse()]) {
    const Icon = c.icon ? ICONS[c.icon] : undefined;
    if (Icon) return { Icon, color };
  }
  return { Icon: categoryIcons[top.slug]?.Icon ?? FALLBACK.Icon, color };
}
