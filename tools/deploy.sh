#!/bin/sh
set -eu

bin_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$bin_dir/froment-software-migrate"
exec "$bin_dir/froment-software"
