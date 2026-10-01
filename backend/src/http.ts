import { Router, Response, RequestHandler } from "express";
import { ZodError } from "zod";

// Express 4 doesn't forward rejected promises from async handlers to the
// error middleware — without this a thrown Prisma error leaves the request
// hanging. Every route file builds its router with this instead of Router().
export function safeRouter() {
  const router = Router();
  for (const method of ["get", "post", "patch", "put", "delete"] as const) {
    const original = router[method].bind(router) as (...args: any[]) => Router;
    (router as any)[method] = (path: string, ...handlers: RequestHandler[]) =>
      original(
        path,
        ...handlers.map((h) => (req: any, res: any, next: any) => Promise.resolve(h(req, res, next)).catch(next))
      );
  }
  return router;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  price: "Price",
  phone: "Phone number",
  username: "Username",
  email: "Email",
  bio: "Bio",
  text: "Message",
  whatsappNumber: "WhatsApp number",
  viberNumber: "Viber number",
};

// Turns a zod error into one human sentence the app can show in a toast,
// e.g. "Title must be at least 3 characters."
export function sendValidationError(res: Response, error: ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "");
  const label = FIELD_LABELS[field] ?? "Some details";
  let message = `${label} looks invalid.`;
  if (issue?.code === "too_small" && issue.type === "string") {
    message = issue.minimum === 1 ? `${label} can't be empty.` : `${label} must be at least ${issue.minimum} characters.`;
  } else if (issue?.code === "too_big" && issue.type === "string") {
    message = `${label} must be ${issue.maximum} characters or fewer.`;
  } else if (issue?.code === "invalid_string" && issue.validation === "email") {
    message = "Please enter a valid email address.";
  } else if (issue?.code === "invalid_string" && issue.validation === "regex") {
    message = field === "username" ? "Usernames can only use letters, numbers and underscores." : `${label} looks invalid.`;
  }
  return res.status(400).json({ error: message });
}

export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export function normalizePhone(raw: string) {
  return raw.replace(/[\s\-()]/g, "");
}
