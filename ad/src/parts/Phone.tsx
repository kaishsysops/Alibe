import React from "react";
import { C, fontFamily } from "../theme";

// A clean phone frame (no particular brand) holding an Alibe screen.
export const PHONE_W = 640;
export const PHONE_H = 1300;

export const Phone: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 96,
      padding: 18,
      background: "#0E0E0E",
      boxShadow: "0 60px 120px rgba(20,20,20,0.28), 0 18px 40px rgba(20,20,20,0.18)",
      ...style,
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 80, overflow: "hidden", background: C.paper, fontFamily }}>
      {children}
      {/* Status bar and island */}
      <div style={{ position: "absolute", top: 22, left: "50%", translate: "-50% 0", width: 190, height: 50, borderRadius: 30, background: "#0E0E0E" }} />
    </div>
  </div>
);

// Top of an Alibe screen: wordmark and a soft search field.
export const AppTop: React.FC<{ search: string; fontSize?: number }> = ({ search, fontSize = 30 }) => (
  <div style={{ padding: "96px 36px 0" }}>
    <div style={{ fontSize: 46, fontWeight: 800, color: C.orange, letterSpacing: -1 }}>Alibe</div>
    <div
      style={{
        marginTop: 22,
        height: 84,
        borderRadius: 42,
        background: C.card,
        border: `2px solid ${C.line}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 30px",
        fontSize,
        color: search ? C.ink : C.muted,
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.4" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span>{search || "Search phones, sofas, boats..."}</span>
    </div>
  </div>
);
