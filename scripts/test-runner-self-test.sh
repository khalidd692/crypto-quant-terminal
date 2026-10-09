#!/usr/bin/env bash
set -u
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/tests"
printf 'console.log("intentional-good-test: PASS");\n' > "$tmp/tests/01-good.js"
printf 'console.error("intentional-broken-test: FAIL"); process.exit(17);\n' > "$tmp/tests/02-broken.js"

set +e
output="$(bash scripts/run-tests.sh "$tmp/tests" 2>&1)"
status=$?
set -e
printf '%s\n' "$output"
if ((status == 0)); then
  echo "ERROR: test runner incorrectly returned success for an intentionally broken test" >&2
  exit 1
fi
if [[ "$output" != *"02-broken.js"* || "$output" != *"Total: 2 | Passed: 1 | Failed: 1"* ]]; then
  echo "ERROR: test runner did not report the broken test and aggregate counts" >&2
  exit 1
fi
echo "test-runner-self-test: PASS (broken test correctly caused non-zero exit)"
