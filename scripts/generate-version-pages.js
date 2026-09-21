const fs = require('fs').promises;
const path = require('path');

const readmeFilePath = './README.md';
const englishReadmeFilePath = './README.en.md';
const versionFilePath = './version.json';
const versionsDirectory = './versions';
const indexFilePath = path.join(versionsDirectory, 'README.md');
const englishIndexFilePath = path.join(versionsDirectory, 'README.en.md');
const indexStart = '<!-- version-pages:start -->';
const indexEnd = '<!-- version-pages:end -->';

function escapeMarkdownText(value) {
    return String(value).replace(/[\\`]/g, '\\$&');
}

function groupVersions(entries) {
    const groups = new Map();
    for (const entry of entries) {
        if (!groups.has(entry.version)) {
            groups.set(entry.version, []);
        }
        groups.get(entry.version).push(entry);
    }
    return [...groups.entries()];
}

function buildVersionPage(version, entries) {
    const dates = [...new Set(entries.map(entry => entry.publish_date))].join('、');
    const downloads = entries.map((entry, index) =>
        `${index + 1}. [下载微信 ${version} Android APK（官方链接）](${entry.url})`
    ).join('\n');

    return `# 微信 ${escapeMarkdownText(version)} Android 历史版本下载\n\n` +
        `[English](README.en.md) · [返回版本索引](../)\n\n` +
        `这是微信 Android ${escapeMarkdownText(version)} 历史版本的官方 APK 下载地址。` +
        `发布日期：${escapeMarkdownText(dates)}。\n\n` +
        `## 微信 ${escapeMarkdownText(version)} 下载地址\n\n` +
        `${downloads}\n\n` +
        `## 版本信息\n\n` +
        `- 软件：微信 Android\n` +
        `- 版本号：${escapeMarkdownText(version)}\n` +
        `- 发布日期：${escapeMarkdownText(dates)}\n` +
        `- 官方安装包数量：${entries.length}\n\n` +
        `## 使用说明\n\n` +
        `下载链接直接指向微信官网的 Android APK 文件。安装旧版本前请确认与设备及现有数据兼容；` +
        `需要查看功能变化时，请查阅[微信官方更新日志](https://weixin.qq.com/updates)。\n\n` +
        `[返回微信 Android 历史版本索引](../)\n`;
}

function buildEnglishVersionPage(version, entries) {
    const dates = [...new Set(entries.map(entry => entry.publish_date))].join(', ');
    const downloads = entries.map((entry, index) =>
        `${index + 1}. [Download WeChat ${version} Android APK (official link)](${entry.url})`
    ).join('\n');

    return `# WeChat ${escapeMarkdownText(version)} for Android: Historical Download\n\n` +
        `[简体中文](README.md) · [All English versions](../README.en.md)\n\n` +
        `This page lists official APK download links for the WeChat ${escapeMarkdownText(version)} Android release. ` +
        `Release date: ${escapeMarkdownText(dates)}.\n\n` +
        `## Official download links\n\n` +
        `${downloads}\n\n` +
        `## Version details\n\n` +
        `- Product: WeChat for Android\n` +
        `- Version: ${escapeMarkdownText(version)}\n` +
        `- Release date: ${escapeMarkdownText(dates)}\n` +
        `- Official APK files recorded: ${entries.length}\n\n` +
        `## Safety note\n\n` +
        `The links point directly to official WeChat Android APK files. Before installing an older version, ` +
        `confirm device compatibility, back up your data, and review the [official WeChat update log](https://weixin.qq.com/updates).\n`;
}

function buildIndex(groups) {
    const rows = groups.map(([version, entries]) => {
        const dates = [...new Set(entries.map(entry => entry.publish_date))].join('、');
        return `- [微信 ${version} Android 历史版本下载](${version}/)（${dates}，${entries.length} 个官方安装包）`;
    }).join('\n');

    return `# 微信 Android 历史版本索引\n\n` +
        `[English](README.en.md)\n\n` +
        `本目录按版本号整理微信 Android 的官方 APK 下载记录。每个版本页面包含版本号、发布日期和全部已记录的官方安装包链接。\n\n` +
        `共 ${groups.length} 个版本。\n\n` +
        `${rows}\n`;
}

function buildEnglishIndex(groups) {
    const rows = groups.map(([version, entries]) => {
        const dates = [...new Set(entries.map(entry => entry.publish_date))].join(', ');
        return `- [WeChat ${version} for Android: Historical Download](${version}/README.en.md) (${dates}; ${entries.length} official APK file${entries.length === 1 ? '' : 's'})`;
    }).join('\n');

    return `# WeChat Android Version Archive\n\n` +
        `[简体中文](README.md)\n\n` +
        `This directory organizes official WeChat Android APK download records by version. Each page includes the version number, release date, and every recorded official APK link.\n\n` +
        `${groups.length} versions are available.\n\n` +
        `${rows}\n`;
}

function buildReadmeIndex(groups) {
    const rows = groups.map(([version, entries]) => {
        const dates = [...new Set(entries.map(entry => entry.publish_date))].join('、');
        return `- [微信 ${version} Android 历史版本下载](versions/${version}/)（${dates}）`;
    }).join('\n');

    return `${indexStart}\n## 按版本浏览\n\n` +
        `以下页面按单一版本号整理，包含对应的官方 APK 下载链接，便于查找特定版本。\n\n` +
        `${rows}\n${indexEnd}`;
}

function buildEnglishReadme(groups) {
    const rows = groups.map(([version, entries]) => {
        const dates = [...new Set(entries.map(entry => entry.publish_date))].join(', ');
        const downloads = entries.map(entry =>
            `| WeChat ${version} for Android | ${entry.publish_date} | [Official APK](${entry.url}) |`
        ).join('\n');
        return { dates, downloads, version };
    });
    const versionRows = rows.map(({ version, dates }) =>
        `- [WeChat ${version} for Android: Historical Download](versions/${version}/README.en.md) (${dates})`
    ).join('\n');
    const downloadRows = rows.map(({ downloads }) => downloads).join('\n');

    return `# WeChat Android Version Archive\n\n` +
        `[简体中文](README.md)\n\n` +
        `This repository records official APK download links for historical WeChat Android releases. Each version has its own page to make a specific version easier to find. Before installing an older version, verify device compatibility, data backup, and security implications.\n\n` +
        `## Data sources and scope\n\n` +
        `- Download links and update information are based on the [official WeChat updates page](https://weixin.qq.com/updates) and official WeChat APK domains.\n` +
        `- The initial historical records used [DJB-Developer/wechat-android-history-versions](https://github.com/DJB-Developer/wechat-android-history-versions) as a research lead; every retained download link points to the official source.\n` +
        `- This repository's fetching, page generation, validation, and GitHub Actions update implementation are independently written. It is not affiliated with Tencent or the reference repository.\n\n` +
        `## Automatic updates\n\n` +
        `The workflow periodically reads official WeChat Android update information. It updates catalog data and version pages only after the version, date, and download URL pass validation. By default it updates metadata only and does not publish APK Releases automatically.\n\n` +
        `## Download records\n\n` +
        `| Version | Release date | Download |\n| :---- | :---- | :---- |\n` +
        `${downloadRows}\n\n` +
        `<!-- version-pages-en:start -->\n## Browse by version\n\n` +
        `Each page groups the official APK links for one version, making it easier to find a specific release.\n\n` +
        `${versionRows}\n<!-- version-pages-en:end -->\n`;
}

async function main() {
    const entries = JSON.parse(await fs.readFile(versionFilePath, 'utf8'));
    const groups = groupVersions(entries);
    await fs.mkdir(versionsDirectory, { recursive: true });

    for (const [version, versionEntries] of groups) {
        const directory = path.join(versionsDirectory, version);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, 'README.md'), buildVersionPage(version, versionEntries), 'utf8');
        await fs.writeFile(path.join(directory, 'README.en.md'), buildEnglishVersionPage(version, versionEntries), 'utf8');
    }

    await fs.writeFile(indexFilePath, buildIndex(groups), 'utf8');
    await fs.writeFile(englishIndexFilePath, buildEnglishIndex(groups), 'utf8');

    const readme = await fs.readFile(readmeFilePath, 'utf8');
    const generatedIndex = buildReadmeIndex(groups);
    const pattern = new RegExp(`${indexStart}[\\s\\S]*?${indexEnd}`);
    const updatedReadme = pattern.test(readme)
        ? readme.replace(pattern, generatedIndex)
        : `${readme.trimEnd()}\n\n${generatedIndex}\n`;
    await fs.writeFile(readmeFilePath, updatedReadme, 'utf8');
    await fs.writeFile(englishReadmeFilePath, buildEnglishReadme(groups), 'utf8');

    console.log(`已生成 ${groups.length} 个版本页面`);
}

main().catch(error => {
    console.error('生成版本页面失败:', error);
    process.exit(1);
});
