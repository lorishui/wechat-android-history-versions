const fs = require('fs').promises;
const path = require('path');

const readmeFilePath = './README.md';
const versionFilePath = './version.json';
const versionsDirectory = './versions';
const indexFilePath = path.join(versionsDirectory, 'README.md');
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

function buildIndex(groups) {
    const rows = groups.map(([version, entries]) => {
        const dates = [...new Set(entries.map(entry => entry.publish_date))].join('、');
        return `- [微信 ${version} Android 历史版本下载](${version}/)（${dates}，${entries.length} 个官方安装包）`;
    }).join('\n');

    return `# 微信 Android 历史版本索引\n\n` +
        `本目录按版本号整理微信 Android 的官方 APK 下载记录。每个版本页面包含版本号、发布日期和全部已记录的官方安装包链接。\n\n` +
        `共 ${groups.length} 个版本。\n\n` +
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

async function main() {
    const entries = JSON.parse(await fs.readFile(versionFilePath, 'utf8'));
    const groups = groupVersions(entries);
    await fs.mkdir(versionsDirectory, { recursive: true });

    for (const [version, versionEntries] of groups) {
        const directory = path.join(versionsDirectory, version);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, 'README.md'), buildVersionPage(version, versionEntries), 'utf8');
    }

    await fs.writeFile(indexFilePath, buildIndex(groups), 'utf8');

    const readme = await fs.readFile(readmeFilePath, 'utf8');
    const generatedIndex = buildReadmeIndex(groups);
    const pattern = new RegExp(`${indexStart}[\\s\\S]*?${indexEnd}`);
    const updatedReadme = pattern.test(readme)
        ? readme.replace(pattern, generatedIndex)
        : `${readme.trimEnd()}\n\n${generatedIndex}\n`;
    await fs.writeFile(readmeFilePath, updatedReadme, 'utf8');

    console.log(`已生成 ${groups.length} 个版本页面`);
}

main().catch(error => {
    console.error('生成版本页面失败:', error);
    process.exit(1);
});
