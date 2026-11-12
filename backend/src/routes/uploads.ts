import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import sharp from "sharp";
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

// Phone photos arrive at 3-10 MB. Shrink them to at most 1600px on the long
// side and re-encode, so feeds load fast on mobile data. JPEGs stay JPEG;
// PNG/WebP become WebP (keeps transparency). HEIC, GIF and video pass through.
// Never fails an upload: if anything goes wrong the original is kept.
const MAX_SIDE = 1600;
async function compress(file: Express.Multer.File) {
  const toJpeg = file.mimetype === "image/jpeg";
  if (!toJpeg && file.mimetype !== "image/png" && file.mimetype !== "image/webp") return file.filename;
  try {
    const name = toJpeg ? file.filename : file.filename.replace(/\.\w+$/, ".webp");
    const pipeline = sharp(file.path).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    const out = await (toJpeg ? pipeline.jpeg({ quality: 80, mozjpeg: true }) : pipeline.webp({ quality: 82 })).toBuffer();
    // Already small (screenshots, simple graphics): keep the original.
    if (out.length >= file.size) return file.filename;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), out);
    if (name !== file.filename) await fs.promises.unlink(file.path);
    file.size = out.length;
    return name;
  } catch (e) {
    console.warn("Couldn't compress upload, keeping the original:", (e as Error).message);
    return file.filename;
  }
}

export const uploadsRouter = safeRouter();

// Accepts one photo or video (multipart field "file") and returns its public
// path. Paths are relative (/uploads/…) so every client resolves them against
// whichever API host it talks to.
uploadsRouter.post("/", (req, res) => {
  upload.single("file")(req, res, async (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "That file is too big. Videos and photos can be up to 50 MB." });
    }
    if (err) return res.status(400).json({ error: "That upload didn't work. Please try again." });
    if (!req.file) return res.status(400).json({ error: "Only photos (JPG, PNG, WebP, HEIC) and videos (MP4, MOV) can be sent." });
    const type = req.file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE";
    const filename = type === "IMAGE" ? await compress(req.file) : req.file.filename;
    res.status(201).json({ url: `/uploads/${filename}`, type, size: req.file.size });
  });
});
