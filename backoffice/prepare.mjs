import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Sqlite from "better-sqlite3";

const database = process.env.DATABASE_PATH;
const backupDirectory = process.env.BACKUP_DIRECTORY;
if (!database || !backupDirectory) throw new Error("database.path_required");
try {
  if (!statSync(database).isFile() || statSync(database).size === 0) {
    throw new Error("database.empty");
  }
} catch {
  throw new Error("database.missing_or_empty");
}

mkdirSync(backupDirectory, { recursive: true });
const backup = join(
  backupDirectory,
  `pre-deploy-${new Date().toISOString()}-${randomUUID()}.sqlite`,
);
try {
  const source = new Sqlite(database, { readonly: true, fileMustExist: true });
  try {
    await source.backup(backup);
  } finally {
    source.close();
  }
  const verified = new Sqlite(backup, { readonly: true, fileMustExist: true });
  try {
    if (verified.pragma("integrity_check", { simple: true }) !== "ok") {
      throw new Error("backup.integrity_failed");
    }
    if (verified.pragma("foreign_key_check").length !== 0) {
      throw new Error("backup.foreign_keys_failed");
    }
  } finally {
    verified.close();
  }
} catch (error) {
  if (existsSync(backup)) unlinkSync(backup);
  throw error;
}

const migration = spawnSync("froment-backoffice", ["migrate"], { stdio: "inherit" });
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);
