#!/bin/sh
set -eu

database=${DATABASE_PATH:-/var/lib/froment-software/froment.sqlite}
backup_directory=${BACKUP_DIRECTORY:-/var/lib/froment-software/backups}

mkdir -p "$backup_directory"

if [ "${REQUIRE_EXISTING_DATABASE:-false}" = true ] && [ ! -s "$database" ]; then
  echo "The required existing database is missing: $database" >&2
  exit 66
fi

if [ -s "$database" ]; then
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  backup="$backup_directory/pre-deploy-$timestamp.sqlite"
  temporary_backup="$backup.tmp"

  rm -f "$temporary_backup"
  sqlite3 "$database" ".backup '$temporary_backup'"
  test "$(sqlite3 "$temporary_backup" 'pragma integrity_check;')" = ok
  test -z "$(sqlite3 "$temporary_backup" 'pragma foreign_key_check;')"
  mv "$temporary_backup" "$backup"
  chmod 0600 "$backup"

  find "$backup_directory" -maxdepth 1 -type f -name 'pre-deploy-*.sqlite' -printf '%T@ %p\n' \
    | sort -nr \
    | tail -n +11 \
    | cut -d ' ' -f 2- \
    | xargs -r rm --
fi

exec froment-software-migrate
