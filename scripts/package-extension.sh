#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
check_script="$script_dir/check-release.sh"
dist_dir="$repo_root/dist"

if ! command -v zip >/dev/null 2>&1 && ! command -v powershell.exe >/dev/null 2>&1; then
  printf 'Packaging failed: zip or PowerShell is required\n' >&2
  exit 1
fi

release_files=()
while IFS= read -r file; do
  [[ -n "$file" ]] && release_files+=("$file")
done < <("$check_script" --print-files)

if ((${#release_files[@]} == 0)); then
  printf 'Packaging failed: release allowlist is empty\n' >&2
  exit 1
fi

version="$(node -e 'const m=require(process.argv[1]); process.stdout.write(m.version)' "$repo_root/manifest.json")"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  printf 'Packaging failed: unsafe manifest version: %s\n' "$version" >&2
  exit 1
fi

mkdir -p "$dist_dir"
temporary_dir="$(mktemp -d "$dist_dir/.video-flow-package.XXXXXX")"
temporary_zip="$temporary_dir/video-flow.zip"
output_zip="$dist_dir/video-flow-v$version.zip"

cleanup() {
  if [[ -f "$temporary_zip" ]]; then
    rm -f "$temporary_zip"
  fi
  if [[ -d "$temporary_dir" ]]; then
    rm -f "$temporary_dir/create-zip.ps1" "$temporary_dir/release-files.txt"
    rmdir "$temporary_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT

(
  cd "$repo_root"
  # Exclude platform-specific extra attributes so identical source files
  # produce the same archive checksum across repeated local builds.
  if command -v zip >/dev/null 2>&1; then
    zip -X -q "$temporary_zip" "${release_files[@]}"
  elif command -v powershell.exe >/dev/null 2>&1; then
    # Git for Windows often has PowerShell but not the Unix zip utility.
    # Build entries explicitly so paths stay relative to the extension root.
    powershell_script="$temporary_dir/create-zip.ps1"
    cat > "$powershell_script" <<'POWERSHELL'
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [Parameter(Mandatory = $true)][string]$FileListPath
)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open(
  $ArchivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  foreach ($relativePath in [System.IO.File]::ReadAllLines($FileListPath)) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) { continue }
    $fullPath = Join-Path $RepoRoot $relativePath
    $entryName = $relativePath -replace '\\', '/'
    $entry = $archive.CreateEntry(
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
    $input = [System.IO.File]::OpenRead($fullPath)
    $output = $entry.Open()
    try {
      $input.CopyTo($output)
    } finally {
      $output.Dispose()
      $input.Dispose()
    }
  }
} finally {
  $archive.Dispose()
}
POWERSHELL
    file_list="$temporary_dir/release-files.txt"
    printf '%s\n' "${release_files[@]}" > "$file_list"
    powershell.exe -NoProfile -NonInteractive \
      -File "$powershell_script" "$repo_root" "$temporary_zip" "$file_list"
  else
    printf 'Packaging failed: zip or PowerShell is required\n' >&2
    exit 1
  fi
)

if unzip -Z1 "$temporary_zip" | grep -En '(^|/)(config\.js|\.DS_Store|\.git)(/|$)' >&2; then
  printf 'Packaging failed: a forbidden private path entered the ZIP\n' >&2
  exit 1
fi

mv -f "$temporary_zip" "$output_zip"
rm -f "$temporary_dir/create-zip.ps1" "$temporary_dir/release-files.txt"
rmdir "$temporary_dir"
trap - EXIT

checksum="$(shasum -a 256 "$output_zip" | awk '{print $1}')"
printf 'Created %s\n' "$output_zip"
printf 'SHA-256: %s\n' "$checksum"
