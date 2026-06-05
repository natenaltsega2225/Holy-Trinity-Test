// backend/services/domains/system/backupService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

const { exec } =
  require("child_process");

const {

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   HELPERS
========================================================= */

function ensureBackupDir() {

  const dir =
    path.join(

      process.cwd(),

      "backups"
    );

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

function timestamp() {

  return new Date()

    .toISOString()

    .replace(/[:.]/g, "-");
}

/* =========================================================
   MYSQL BACKUP
========================================================= */

async function createDatabaseBackup({

  host =
    process.env.DB_HOST,

  port =
    process.env.DB_PORT || 3306,

  user =
    process.env.DB_USER,

  password =
    process.env.DB_PASSWORD,

  database =
    process.env.DB_NAME,
} = {}) {

  return new Promise(

    (
      resolve,
      reject
    ) => {

      try {

        const dir =
          ensureBackupDir();

        const fileName =
          `db-backup-${timestamp()}.sql`;

        const filePath =
          path.join(
            dir,
            fileName
          );

        const command =
          `
          mysqldump
            -h ${host}
            -P ${port}
            -u ${user}
            -p${password}
            ${database}
            > "${filePath}"
          `;

        exec(

          command,

          (
            error
          ) => {

            if (error) {

              return reject(
                error
              );
            }

            return resolve({

              success: true,

              type:
                "database",

              file_name:
                fileName,

              file_path:
                filePath,

              created_at:
                mysqlNow(),
            });
          }
        );

      } catch (err) {

        reject(err);
      }
    }
  );
}

/* =========================================================
   DIRECTORY BACKUP
========================================================= */

async function createDirectoryBackup({

  sourcePath,

  label = "files",
} = {}) {

  return new Promise(

    (
      resolve,
      reject
    ) => {

      try {

        const dir =
          ensureBackupDir();

        const fileName =
          `${label}-${timestamp()}.tar.gz`;

        const filePath =
          path.join(
            dir,
            fileName
          );

        const command =
          `
          tar -czf
          "${filePath}"
          "${sourcePath}"
          `;

        exec(

          command,

          (
            error
          ) => {

            if (error) {

              return reject(
                error
              );
            }

            return resolve({

              success: true,

              type:
                "directory",

              file_name:
                fileName,

              file_path:
                filePath,

              created_at:
                mysqlNow(),
            });
          }
        );

      } catch (err) {

        reject(err);
      }
    }
  );
}

/* =========================================================
   FULL SYSTEM BACKUP
========================================================= */

async function createFullSystemBackup() {

  const results = [];

  /* =====================================
     DATABASE
  ===================================== */

  try {

    const dbBackup =
      await createDatabaseBackup();

    results.push(
      dbBackup
    );

  } catch (err) {

    console.error(
      "Database backup failed:",
      err.message
    );
  }

  /* =====================================
     UPLOADS
  ===================================== */

  try {

    const uploadsBackup =
      await createDirectoryBackup({

        sourcePath:
          path.join(
            process.cwd(),
            "uploads"
          ),

        label:
          "uploads",
      });

    results.push(
      uploadsBackup
    );

  } catch (err) {

    console.error(
      "Uploads backup failed:",
      err.message
    );
  }

  return {

    success: true,

    backups:
      results,
  };
}

/* =========================================================
   LIST BACKUPS
========================================================= */

async function listBackups() {

  const dir =
    ensureBackupDir();

  const files =
    await fs.promises.readdir(
      dir
    );

  const rows = [];

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

      rows.push({

        file_name:
          file,

        file_path:
          fullPath,

        size:
          stats.size,

        created_at:
          stats.birthtime,
      });

    } catch {}
  }

  return rows.sort(

    (a, b) =>

      new Date(
        b.created_at
      ) -

      new Date(
        a.created_at
      )
  );
}

/* =========================================================
   CLEAN OLD BACKUPS
========================================================= */

async function cleanupBackups(
  olderThanDays = 30
) {

  const dir =
    ensureBackupDir();

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

      const ageDays =

        (
          Date.now() -
          stats.mtimeMs
        ) /

        (1000 * 60 * 60 * 24);

      if (
        ageDays >
        olderThanDays
      ) {

        await fs.promises.unlink(
          fullPath
        );

        deleted++;
      }

    } catch (err) {

      console.error(
        "cleanupBackups error:",
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
   EXPORTS
========================================================= */

module.exports = {

  createDatabaseBackup,

  createDirectoryBackup,

  createFullSystemBackup,

  listBackups,

  cleanupBackups,
};