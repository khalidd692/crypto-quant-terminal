#!/usr/bin/env bash
set -u

test_dir="${1:-dist/tests}"
shopt -s nullglob
files=("$test_dir"/*.js)
if (("${#files[@]}" == 0)); then
  echo "ERROR: no compiled tests found in $test_dir" >&2
  exit 2
fi

passed=0
failed=0
failed_files=()
for file in "${files[@]}"; do
  printf '\n===== TEST: %s =====\n' "$file"
  if node "$file"; then
    ((passed += 1))
    printf 'PASS: %s\n' "$file"
  else
    status=$?
    ((failed += 1))
    failed_files+=("$file (exit $status)")
    printf 'FAIL: %s (exit %s)\n' "$file" "$status" >&2
  fi
done

printf '\n===== TEST SUMMARY =====\n'
printf 'Total: %s | Passed: %s | Failed: %s\n' "${#files[@]}" "$passed" "$failed"
if ((failed > 0)); then
  printf 'Failed tests:\n' >&2
  printf ' - %s\n' "${failed_files[@]}" >&2
  exit 1
fi
