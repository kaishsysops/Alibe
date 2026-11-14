import crypto from "node:crypto";

// "Sign in with Google": checks the ID token Google gives the browser. No SDK:
// the token is a JWT signed with one of Google's published RSA keys, so this
// verifies the signature with Node's crypto and then the claims.
//   GOOGLE_CLIENT_ID (comma-separated for several apps) in .env turns it on.

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export const googleClientIds = () =>
  (process.env.GOOGLE_CLIENT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string };
let keys: { byKid: Map<string, crypto.KeyObject>; expiresAt: number } | null = null;

// Google rotates its keys; they're cached for as long as Google says.
async function signingKey(kid: string) {
  if (!keys || keys.expiresAt < Date.now() || !keys.byKid.has(kid)) {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new Error(`Google keys: ${res.status}`);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
    const { keys: list } = (await res.json()) as { keys: Jwk[] };
    keys = {
      byKid: new Map(list.map((k) => [k.kid, crypto.createPublicKey({ key: k as crypto.JsonWebKey, format: "jwk" })])),
      expiresAt: Date.now() + Math.min(maxAge, 86_400) * 1000,
    };
  }
  return keys.byKid.get(kid);
}

export type GoogleProfile = { sub: string; email: string; name: string };

// The person's Google id, verified email and name, or null if the token isn't
// a genuine, current Google sign-in for this app.
export async function verifyGoogleToken(token: string): Promise<GoogleProfile | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSig] = parts;
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(rawHeader, "base64url").toString());
    claims = JSON.parse(Buffer.from(rawPayload, "base64url").toString());
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const key = await signingKey(header.kid);
  if (!key) return null;
  const valid = crypto.verify("RSA-SHA256", Buffer.from(`${rawHeader}.${rawPayload}`), key, Buffer.from(rawSig, "base64url"));
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.includes(String(claims.iss))) return null;
  if (!googleClientIds().includes(String(claims.aud))) return null;
  if (typeof claims.exp !== "number" || claims.exp < now - 60) return null;
  // Only an email Google has confirmed can stand in for our emailed code.
  if (claims.email_verified !== true || typeof claims.email !== "string" || typeof claims.sub !== "string") return null;
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : String(claims.email).split("@")[0];
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: name.slice(0, 40) };
}
