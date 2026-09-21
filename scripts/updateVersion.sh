#!/usr/bin/env bash

set -euo pipefail

readonly max_apk_size=$((512 * 1024 * 1024))
download_directory=''

cleanup() {
    if [[ -n "$download_directory" && -d "$download_directory" ]]; then
        rm -rf -- "$download_directory"
    fi
}
trap cleanup EXIT

function check_update() {
    wechat_info="$(node scripts/getVersion.js)"
    if [[ -z "$wechat_info" ]]; then
        return
    fi
    IFS="|" read -ra parts <<< "$wechat_info"
    if [[ "${#parts[@]}" -ne 4 || ! "$wechat_info" =~ ^微信\ [0-9]+(\.[0-9]+)+\ for\ Android\|https://(dldir1|dldir1v6)\.qq\.com/weixin/android/weixin[0-9a-z_]+\.apk\|[0-9]+(\.[0-9]+)+\|weixin[0-9a-z_]+\.apk$ ]]; then
        >&2 echo '更新检查返回了不安全的数据格式，已拒绝执行。'
        exit 1
    fi
    version_info="${parts[0]}"
    download_link="${parts[1]}"
    version="${parts[2]}"
    file_name="${parts[3]}"
}

function wechat_download() {
    download_directory="$(mktemp -d)"
    local apk_path="$download_directory/$file_name"
    curl --fail --silent --show-error --proto '=https' --connect-timeout 15 --max-time 300 \
        --output "$apk_path" -- "$download_link"
    if [[ ! -s "$apk_path" || $(wc -c < "$apk_path") -gt "$max_apk_size" ]]; then
        >&2 echo 'APK 下载为空或超过大小限制。'
        exit 1
    fi
    unzip -tq "$apk_path" >/dev/null
    publish_release "$apk_path"
}

function publish_release() {
    local apk_path="$1"
    local checksum_file="$download_directory/$file_name.sha256"
    local apk_sum256
    apk_sum256="$(shasum -a 256 "$apk_path" | awk '{print $1}')"
    local apk_version="$version_info $(date -u '+%Y%m%d')"
    printf '发布版本: %s\n更新日期: %s (UTC)\n下载地址: %s\nSha256: %s\n' \
        "$version" "$(date -u '+%Y-%m-%d %H:%M:%S')" "$download_link" "$apk_sum256" > "$checksum_file"
    local release_tag="v${version}"
    if gh release view "$release_tag" >/dev/null 2>&1; then
        gh release upload "$release_tag" "$apk_path" --clobber
    else
        gh release create "$release_tag" "$apk_path" \
            --notes-file "$checksum_file" --title "$apk_version"
    fi
}

function main() {
    git config --local user.email "actions@github.com"
    git config --local user.name "GithubActions"
    check_update
    node scripts/generate-version-pages.js
    if ! git diff --quiet -- README.md version.json versions; then
        if [[ -z "${wechat_info:-}" ]]; then
            >&2 echo '检测到未关联新版本的文件变更，已拒绝自动提交。'
            exit 1
        fi
        node scripts/validate.js
        if [[ "${PUBLISH_RELEASE:-false}" == 'true' ]]; then
            wechat_download
        fi
        git add README.md version.json versions
        git commit -m "$version_info"
        git push origin main
        if [[ "${PUBLISH_RELEASE:-false}" != 'true' ]]; then
            echo '版本索引已更新；为避免自动发布未验证 APK，已跳过 Release。'
        fi
    fi
}

main
