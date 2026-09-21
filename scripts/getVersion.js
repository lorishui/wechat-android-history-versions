const fs = require('fs').promises;

const url = 'https://weixin.qq.com/updates';
const readmeFilePath = './README.md';
const versionFilePath = './version.json';
const allowedDownloadHosts = new Set(['dldir1.qq.com', 'dldir1v6.qq.com']);

function isValidVersion(version) {
    return typeof version === 'string' && /^\d+(?:\.\d+)+$/.test(version);
}

function isValidPublishDate(date) {
    return typeof date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        new Date(`${date}T00:00:00.000Z`).toISOString().startsWith(date);
}

function parseOfficialDownloadUrl(value) {
    if (typeof value !== 'string' || value.trim() !== value) {
        throw new Error('下载地址不是字符串');
    }

    const parsed = new URL(value);
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    if (parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.port ||
        !allowedDownloadHosts.has(parsed.hostname) ||
        !parsed.pathname.startsWith('/weixin/android/') ||
        parsed.search ||
        parsed.hash ||
        !/^weixin[0-9a-z_]+\.apk$/.test(fileName)) {
        throw new Error('下载地址不符合微信官网 Android APK 地址规则');
    }

    return { url: parsed.toString(), fileName };
}

async function fetchText(requestUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

async function get(requestUrl) {
    const data = await fetchText(requestUrl);
    const updateUrl = getUpdateUri(data);
    if (!updateUrl) {
        return;
    }

    const updateData = await fetchText(updateUrl);
    const updateInfo = getUpdateInfo(updateData);
    if (!updateInfo) {
        throw new Error('官网 API 返回了不符合安全规则的数据');
    }
    const added = await updateREADME(updateInfo);
    const versionAdded = await updateVersionFile(updateInfo);
    if (added || versionAdded) {
        console.log(`${updateInfo.version_info}|${updateInfo.url}|${updateInfo.version}|${updateInfo.fileName}`);
    }
}

async function updateREADME(updateInfo) {
    try {
        const data = await fs.readFile(readmeFilePath, 'utf8');
        if (data.includes(updateInfo.url)) {
            return false;
        }

        const lines = data.split('\n');
        const tableHeaderIndex = lines.findIndex(line =>
            line.includes('|  :----  | :----  | :----  |')
        );

        if (tableHeaderIndex !== -1) {
            lines.splice(tableHeaderIndex + 1, 0, updateInfo.text);
            await fs.writeFile(readmeFilePath, lines.join('\n'), 'utf8');
            return true;
        }
    } catch (error) {
        console.error('更新 README 文件时出错:', error);
    }
    return false;
}

async function updateVersionFile(updateInfo) {
    try {
        let versionData = [];
        try {
            versionData = JSON.parse(await fs.readFile(versionFilePath, 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        const existingEntry = versionData.find(entry => entry.url === updateInfo.url);
        if (existingEntry) {
            return false;
        }

        versionData.unshift({
            name: updateInfo.version_info,
            version: updateInfo.version,
            publish_date: updateInfo.publish_date,
            url: updateInfo.url,
            updated: new Date().getTime()
        });
        await fs.writeFile(versionFilePath, JSON.stringify(versionData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('更新 version.json 文件时出错:', error);
    }
    return false;
}

function getUpdateUri(html) {
    const pattern = /<section id="android"[^>]*>[\s\S]*?<ul class="faq_section_sublist"[^>]*>[\s\S]*?<li class="faq_section_sublist_item"[^>]*>[\s\S]*?<span class="version"[^>]*>([\d.]+)<\/span>/;
    const match = html.match(pattern);
    if (match) {
        const version = match[1].trim();
        if (!isValidVersion(version)) {
            throw new Error('官网页面返回了无效版本号');
        }
        const versionNum = version.replace(/\./g, '');
        return `https://weixin.qq.com/api/updates_items?platform=android&version=${versionNum}`;
    }
    return null;
}

function getUpdateInfo(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!isValidVersion(data.version)) {
            throw new Error('无效版本号');
        }
        if (!isValidPublishDate(data.publishDate)) {
            throw new Error('无效发布日期');
        }
        const download = parseOfficialDownloadUrl(data.downloadUrl);
        return {
            text: `| 微信 ${data.version} for Android  | (${data.publishDate}) | [${download.url}](${download.url}) |`,
            version_info: `微信 ${data.version} for Android`,
            url: download.url,
            fileName: download.fileName,
            version: data.version,
            publish_date: data.publishDate
        };
    } catch (error) {
        console.error('解析JSON数据时出错:', error);
        return false;
    }
}

if (require.main === module) {
    get(url).catch(error => {
        console.error('更新检查失败:', error.message);
        process.exit(1);
    });
}

module.exports = { isValidPublishDate, isValidVersion, parseOfficialDownloadUrl };
