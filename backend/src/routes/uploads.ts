import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import { safeRouter } from "../http.js";

export const UPLOAD_DIR = path.resolve("uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSIONS[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in EXTENSIONS),
});

export const uploadsRouter = safeRouter();

// Accepts one photo or video (multipart field "file") and returns its public
// path. Paths are relative (/uploads/…) so every client resolves them against
// whichever API host it talks to.
uploadsRouter.post("/", (req, res) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "That file is too big. Videos and photos can be up to 50 MB." });
    }
    if (err) return res.status(400).json({ error: "That upload didn't work. Please try again." });
    if (!req.file) return res.status(400).json({ error: "Only photos (JPG, PNG, WebP, HEIC) and videos (MP4, MOV) can be sent." });
    const type = req.file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE";
    res.status(201).json({ url: `/uploads/${req.file.filename}`, type, size: req.file.size });
  });
});
