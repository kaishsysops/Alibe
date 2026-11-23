import { Megaphone, LayoutDashboard, BadgeCheck, ClipboardCheck, Flag, Scale, Users, Landmark, UserCog, FolderTree, Store, LucideIcon } from "lucide-react-native";
import type { StaffMe, StaffRole } from "../api/client";
import type { Site } from "../site";

// Everything the admin and portal sites can show. A section appears when the
// person is an admin or holds one of its roles; adminOnly sections exist only
// on admin.alibe.online. The server checks the same rules (backend/src/roles.ts).
export type SectionKey = "Overview" | "Applications" | "Posts" | "Reports" | "Disputes" | "Sellers" | "Payments" | "Promotions" | "Staff" | "Categories" | "Ibay";

export type Section = {
  key: SectionKey;
  path: string;
  title: string;
  blurb: string;
  Icon: LucideIcon;
  roles: StaffRole[];
  adminOnly?: boolean;
  count?: keyof StaffMe["counts"];
};

export const SECTIONS: Section[] = [
  { key: "Overview", path: "", title: "Overview", blurb: "What's waiting for you.", Icon: LayoutDashboard, roles: ["SELLER_APPROVER", "POST_APPROVER", "MODERATOR", "SUPPORT"] },
  { key: "Applications", path: "applications", title: "Seller applications", blurb: "ID checks and stores waiting for approval.", Icon: BadgeCheck, roles: ["SELLER_APPROVER"], count: "applications" },
  { key: "Posts", path: "posts", title: "Posts to approve", blurb: "Posts a risk check held back. Everything else is already live.", Icon: ClipboardCheck, roles: ["POST_APPROVER"], count: "posts" },
  { key: "Reports", path: "reports", title: "Reports", blurb: "What people have flagged.", Icon: Flag, roles: ["MODERATOR"], count: "reports" },
  { key: "Disputes", path: "disputes", title: "Disputes", blurb: "Orders where buyer and seller disagree.", Icon: Scale, roles: ["SUPPORT", "MODERATOR"], count: "disputes" },
  { key: "Sellers", path: "sellers", title: "Sellers", blurb: "Look up anyone who sells.", Icon: Users, roles: ["SUPPORT", "SELLER_APPROVER", "MODERATOR"] },
  { key: "Payments", path: "payments", title: "Payments and prices", blurb: "Slips to check, bank details, plan and boost prices.", Icon: Landmark, roles: [], adminOnly: true },
  { key: "Promotions", path: "promotions", title: "Promotions", blurb: "Banners, events, discounts, seasonal looks and staff notices.", Icon: Megaphone, roles: [], adminOnly: true },
  { key: "Staff", path: "staff", title: "Staff and roles", blurb: "Add admins and approvers, change roles.", Icon: UserCog, roles: [], adminOnly: true },
  { key: "Categories", path: "categories", title: "Categories", blurb: "The category tree and its questions.", Icon: FolderTree, roles: [], adminOnly: true },
  { key: "Ibay", path: "ibay", title: "iBay items", blurb: "The iBay catalogue and showcase switch.", Icon: Store, roles: [], adminOnly: true },
];

export function visibleSections(me: StaffMe, site: Site) {
  return SECTIONS.filter((s) => {
    if (s.adminOnly) return site === "admin" && me.admin;
    return me.admin || s.roles.some((r) => me.roles.includes(r));
  });
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  SELLER_APPROVER: "Seller approver",
  POST_APPROVER: "Post approver",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
};

export const ROLE_HELP: Record<StaffRole, string> = {
  SELLER_APPROVER: "Approves ID checks and stores (sees ID photos)",
  POST_APPROVER: "Approves posts from unverified sellers",
  MODERATOR: "Handles reports and removes listings (no bans)",
  SUPPORT: "Looks up sellers and disputes, changes nothing",
};

export function accessLabel(me: StaffMe) {
  if (me.admin) return "Admin";
  return me.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Staff";
}
