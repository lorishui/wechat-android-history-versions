const fs = require('fs').promises;

const catalogPath = './version.json';
const readmePath = './README.md';
const officialDownloadHosts = new Set(['dldir1.qq.com', 'dldir1v6.qq.com']);
const readmeTableDivider = '|  :----  | :----  | :----  |';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertVersion(value) {
    assert(typeof value === 'string' && /^\d+(?:\.\d+)+$/.test(value), '版本号格式无效');
    return value;
}

function assertDate(value) {
    assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), '发布日期格式无效');
    assert(new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value), '发布日期不存在');
    return value;
}

function parseOfficialApkUrl(value) {
    assert(typeof value === 'string' && value.trim() === value, '下载地址格式无效');
    const parsed = new URL(value);
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    assert(parsed.protocol === 'https:', '下载地址必须使用 HTTPS');
    assert(!parsed.username && !parsed.password && !parsed.port, '下载地址不能包含认证或端口');
    assert(officialDownloadHosts.has(parsed.hostname), '下载地址不属于允许的官方域名');
    assert(parsed.pathname.startsWith('/weixin/android/'), '下载地址路径无效');
    assert(!parsed.search && !parsed.hash, '下载地址不能包含查询参数或片段');
    assert(/^weixin[0-9a-z_]+\.apk$/.test(fileName), 'APK 文件名无效');
    return { url: parsed.toString(), fileName };
}

function toCatalogEntry(apiResponse) {
    assert(apiResponse && typeof apiResponse === 'object', '官网接口未返回对象');
    const version = assertVersion(apiResponse.version);
    const publishDate = assertDate(apiResponse.publishDate);
    const download = parseOfficialApkUrl(apiResponse.downloadUrl);
    return { name: `微信 ${version} for Android`, version, publish_date: publishDate, url: download.url, updated: Date.now() };
}

async function fetchText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        assert(response.ok, `官网请求失败：${response.status}`);
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

function extractAndroidVersion(html) {
    const androidSection = html.match(/<section\s+id="android"[\s\S]*?<\/section>/i);
    assert(androidSection, '官网页面未找到 Android 更新区域');
    return assertVersion(androidSection[0].match(/<span\s+class="version"[^>]*>\s*([\d.]+)\s*<\/span>/i)?.[1]);
}

function officialUpdateApi(version) {
    return `https://weixin.qq.com/api/updates_items?platform=android&version=${version.replaceAll('.', '')}`;
}

function readmeRow(entry) {
    return `| ${entry.name}  | (${entry.publish_date}) | [${entry.url}](${entry.url}) |`;
}

async function readCatalog() {
    const entries = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
    assert(Array.isArray(entries), 'version.json 必须是数组');
    return entries;
}

async function writeCatalog(entries) {
    await fs.writeFile(catalogPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

async function addReadmeRow(entry) {
    const lines = (await fs.readFile(readmePath, 'utf8')).split('\n');
    const divider = lines.indexOf(readmeTableDivider);
    assert(divider !== -1, 'README 中缺少版本目录表格');
    lines.splice(divider + 1, 0, readmeRow(entry));
    await fs.writeFile(readmePath, lines.join('\n'), 'utf8');
}

module.exports = { addReadmeRow, assertDate, assertVersion, extractAndroidVersion, fetchText, officialUpdateApi, parseOfficialApkUrl, readCatalog, toCatalogEntry, writeCatalog };
