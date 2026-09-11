#!/bin/sh
set -eu

bin_dir=${0%/*}
"$bin_dir/froment-software-prepare"
exec "$bin_dir/froment-software"
