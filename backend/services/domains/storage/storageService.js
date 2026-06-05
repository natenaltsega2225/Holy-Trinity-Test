// backend/services/domains/storage/storageService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

const crypto =
  require("crypto");

/* =========================================================
   CONFIG
========================================================= */

const STORAGE_ROOT =
  path.join(
    process.cwd(),
    "uploads"
  );

/* =========================================================
   HELPERS
========================================================= */

function ensureDir(
  dir
) {

  if (
    !fs.existsSync(dir)
  ) {

    fs.mkdirSync(
      dir,
      {
        recursive: true,
      }
    );
  }

  return dir;
}

function safeFileName(
  name
) {

  return String(
    name || "file"
  )

    .replace(
      /[^a-zA-Z0-9.\-_]/g,
      "-"
    )

    .toLowerCase();
}

function generateFileName(
  originalName
) {

  const ext =
    path.extname(
      originalName || ""
    );

  const random =
    crypto
      .randomBytes(8)
      .toString("hex");

  return `${Date.now()}-${random}${ext}`;
}

/* =========================================================
   STORAGE PATHS
========================================================= */

const STORAGE_FOLDERS = {

  receipts:
    "receipts",

  invoices:
    "invoices",

  gallery:
    "gallery",

  resources:
    "resources",

  exports:
    "exports",

  forms:
    "forms",

  temp:
    "temp",

  backups:
    "backups",
};

/* =========================================================
   GET STORAGE PATH
========================================================= */

function getStoragePath(
  folder
) {

  const folderName =

    STORAGE_FOLDERS[
      folder
    ] || folder;

  return ensureDir(
    path.join(
      STORAGE_ROOT,
      folderName
    )
  );
}

/* =========================================================
   SAVE FILE
========================================================= */

async function saveFile({

  folder,

  fileBuffer,

  originalName,
}) {

  const dir =
    getStoragePath(
      folder
    );

  const fileName =
    generateFileName(
      originalName
    );

  const filePath =
    path.join(
      dir,
      fileName
    );

  await fs.promises.writeFile(
    filePath,
    fileBuffer
  );

  return {

    success: true,

    folder,

    file_name:
      fileName,

    original_name:
      safeFileName(
        originalName
      ),

    file_path:
      filePath,

    file_url:
      `/uploads/${folder}/${fileName}`,
  };
}

/* =========================================================
   MOVE FILE
========================================================= */

async function moveFile({

  sourcePath,

  targetFolder,
}) {

  const targetDir =
    getStoragePath(
      targetFolder
    );

  const fileName =
    path.basename(
      sourcePath
    );

  const targetPath =
    path.join(
      targetDir,
      fileName
    );

  await fs.promises.rename(

    sourcePath,

    targetPath
  );

  return {

    success: true,

    file_name:
      fileName,

    file_path:
      targetPath,

    file_url:
      `/uploads/${targetFolder}/${fileName}`,
  };
}

/* =========================================================
   DELETE FILE
========================================================= */

async function deleteFile(
  filePath
) {

  try {

    if (
      fs.existsSync(
        filePath
      )
    ) {

      await fs.promises.unlink(
        filePath
      );
    }

    return {

      success: true,
    };

  } catch (err) {

    console.error(
      "deleteFile error:",
      err
    );

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   FILE EXISTS
========================================================= */

async function fileExists(
  filePath
) {

  return fs.existsSync(
    filePath
  );
}

/* =========================================================
   GET FILE STATS
========================================================= */

async function getFileStats(
  filePath
) {

  try {

    const stats =
      await fs.promises.stat(
        filePath
      );

    return {

      success: true,

      size:
        stats.size,

      created_at:
        stats.birthtime,

      updated_at:
        stats.mtime,
    };

  } catch (err) {

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   LIST FILES
========================================================= */

async function listFiles(
  folder
) {

  try {

    const dir =
      getStoragePath(
        folder
      );

    const files =
      await fs.promises.readdir(
        dir
      );

    return {

      success: true,

      files,
    };

  } catch (err) {

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   CLEAN TEMP FILES
========================================================= */

async function cleanupTempFiles(
  olderThanHours = 24
) {

  const dir =
    getStoragePath(
      "temp"
    );

  const files =
    await fs.promises.readdir(
      dir
    );

  let deleted = 0;

  for (const file of files) {

    try {

      const fullPath =
        path.join(
          dir,
          file
        );

      const stats =
        await fs.promises.stat(
          fullPath
        );

      const ageHours =

        (
          Date.now() -
          stats.mtimeMs
        ) /

        (1000 * 60 * 60);

      if (
        ageHours >
        olderThanHours
      ) {

        await fs.promises.unlink(
          fullPath
        );

        deleted++;
      }

    } catch (err) {

      console.error(
        "cleanupTempFiles error:",
        err.message
      );
    }
  }

  return {

    success: true,

    deleted,
  };
}

/* =========================================================
   STORAGE STATS
========================================================= */

async function getStorageStats() {

  let totalFiles = 0;

  let totalSize = 0;

  for (const folder of Object.values(
    STORAGE_FOLDERS
  )) {

    try {

      const dir =
        getStoragePath(
          folder
        );

      const files =
        await fs.promises.readdir(
          dir
        );

      totalFiles +=
        files.length;

      for (const file of files) {

        try {

          const stats =
            await fs.promises.stat(
              path.join(
                dir,
                file
              )
            );

          totalSize +=
            stats.size;

        } catch {}
      }

    } catch {}
  }

  return {

    total_files:
      totalFiles,

    total_size_bytes:
      totalSize,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  STORAGE_ROOT,

  STORAGE_FOLDERS,

  getStoragePath,

  saveFile,

  moveFile,

  deleteFile,

  fileExists,

  getFileStats,

  listFiles,

  cleanupTempFiles,

  getStorageStats,
};