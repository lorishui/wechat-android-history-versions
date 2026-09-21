#!/usr/bin/env bash

set -euo pipefail

readonly max_apk_size=$((512 * 1024 * 1024))
temporary_directory=''

cleanup() {
    if [[ -n "$temporary_directory" && -d "$temporary_directory" ]]; then
        rm -rf -- "$temporary_directory"
    fi
}
trap cleanup EXIT

release_apk() {
    local version="$1"
    local url
    url="$(node -e "const item=require('./version.json').find(x=>x.version===process.argv[1]); if (!item) process.exit(1); process.stdout.write(item.url)" "$version")"
    local file_name="${url##*/}"
    temporary_directory="$(mktemp -d)"
    local apk_path="$temporary_directory/$file_name"
    local notes_path="$temporary_directory/release-notes.txt"

    curl --fail --silent --show-error --proto '=https' --connect-timeout 15 --max-time 300 --output "$apk_path" -- "$url"
    [[ -s "$apk_path" && $(wc -c < "$apk_path") -le "$max_apk_size" ]] || { echo 'APK 文件为空或超过大小限制。' >&2; exit 1; }
    unzip -tq "$apk_path" >/dev/null
    printf '版本：%s\n下载地址：%s\nSHA-256：%s\n' "$version" "$url" "$(shasum -a 256 "$apk_path" | awk '{print $1}')" > "$notes_path"

    if gh release view "v$version" >/dev/null 2>&1; then
        gh release upload "v$version" "$apk_path" --clobber
    else
        gh release create "v$version" "$apk_path" --title "微信 $version for Android" --notes-file "$notes_path"
    fi
}

main() {
    git config --local user.name 'github-actions[bot]'
    git config --local user.email '41898282+github-actions[bot]@users.noreply.github.com'
    local version
    version="$(node scripts/getVersion.js)"
    node scripts/generate-version-pages.js

    if git diff --quiet -- README.md version.json versions; then exit 0; fi
    [[ "$version" =~ ^[0-9]+(\.[0-9]+)+$ ]] || { echo '检测到未关联版本号的目录变更，停止提交。' >&2; exit 1; }
    node scripts/validate.js
    if [[ "${PUBLISH_RELEASE:-false}" == true ]]; then release_apk "$version"; fi
    git add README.md version.json versions
    git commit -m "feat(data): add WeChat Android $version"
    git push origin HEAD:main
}

main
