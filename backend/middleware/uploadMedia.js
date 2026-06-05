//backend\middleware\uploadMedia.js
"use strict";

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const root = path.join(__dirname, "..", "uploads");
const photosDir = path.join(root, "gallery");
const resourcesDir = path.join(root, "resources");
const thumbsDir = path.join(root, "resource-thumbs");

[ root, photosDir, resourcesDir, thumbsDir ].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function safeName(name) {
  return String(name || "file")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "image" || file.fieldname === "cover_image") {
      return cb(null, photosDir);
    }
    if (file.fieldname === "pdf_file") {
      return cb(null, resourcesDir);
    }
    if (file.fieldname === "thumbnail") {
      return cb(null, thumbsDir);
    }
    return cb(null, root);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext);
    cb(null, `${Date.now()}-${safeName(base)}${ext.toLowerCase()}`);
  },
});

function fileFilter(_req, file, cb) {
  const isImage = /^image\//.test(file.mimetype);
  const isPdf = file.mimetype === "application/pdf";

  if (["image", "cover_image", "thumbnail"].includes(file.fieldname) && isImage) {
    return cb(null, true);
  }

  if (file.fieldname === "pdf_file" && isPdf) {
    return cb(null, true);
  }

  return cb(new Error(`Invalid upload type for ${file.fieldname}`));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

module.exports = upload;