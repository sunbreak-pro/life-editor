import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import log from "../logger";

export function migrateUserData(): void {
  const appData = app.getPath("appData");
  const newUserData = app.getPath("userData");

  // Build old userData paths (productName change means app.getPath won't return old path)
  const isDev = !app.isPackaged;
  const oldDirName = isDev ? "sonic-flow" : "Sonic Flow";
  const oldUserData = path.join(appData, oldDirName);

  // Skip if new userData already has a DB (already migrated or fresh install with data)
  const newDbPath = path.join(newUserData, "life-editor.db");
  if (fs.existsSync(newDbPath)) {
    log.info("[Migration] life-editor.db already exists, skipping migration");
    return;
  }

  // Skip if old userData doesn't exist (new install)
  if (!fs.existsSync(oldUserData)) {
    log.info("[Migration] No old userData found, skipping migration");
    return;
  }

  log.info(
    `[Migration] Migrating userData from ${oldUserData} to ${newUserData}`,
  );

  // Ensure new userData directory exists
  if (!fs.existsSync(newUserData)) {
    fs.mkdirSync(newUserData, { recursive: true });
  }

  // Copy contents from old to new
  const entries = fs.readdirSync(oldUserData, { withFileTypes: true });
  for (const entry of entries) {
    const oldPath = path.join(oldUserData, entry.name);
    let newName = entry.name;

    // Rename DB files
    if (entry.name === "sonic-flow.db") newName = "life-editor.db";
    else if (entry.name === "sonic-flow.db-wal") newName = "life-editor.db-wal";
    else if (entry.name === "sonic-flow.db-shm") newName = "life-editor.db-shm";

    const newPath = path.join(newUserData, newName);

    // Skip if target already exists
    if (fs.existsSync(newPath)) {
      log.info(`[Migration] Skipping ${newName} (already exists)`);
      continue;
    }

    try {
      if (entry.isDirectory()) {
        fs.cpSync(oldPath, newPath, { recursive: true });
      } else {
        fs.copyFileSync(oldPath, newPath);
      }
      log.info(`[Migration] Copied ${entry.name} → ${newName}`);
    } catch (e) {
      log.warn(`[Migration] Failed to copy ${entry.name}:`, e);
    }
  }

  // Keep old directory for rollback safety
  log.info(
    "[Migration] userData migration completed (old directory preserved)",
  );
}
