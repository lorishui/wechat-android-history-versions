const fs = require('fs').promises;
const path = require('path');
const { assertDate, assertVersion, parseOfficialApkUrl, readCatalog } = require('./catalog');

function urlsInReadme(content) {
    return [...content.matchAll(/^\|[^|]+\|[^|]+\|\s*\[[^\]]+\]\((https:\/\/[^)\s]+)\)\s*\|/gm)].map(match => match[1]);
}

function duplicates(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

async function main() {
    const entries = await readCatalog();
    const errors = [];
    for (const [index, entry] of entries.entries()) {
        try {
            assertVersion(entry.version);
            assertDate(entry.publish_date);
            parseOfficialApkUrl(entry.url);
        } catch (error) {
            errors.push(`version.json 第 ${index + 1} 条：${error.message}`);
        }
    }

    const catalogUrls = entries.map(entry => entry.url);
    const readme = await fs.readFile('./README.md', 'utf8');
    const englishReadme = await fs.readFile('./README.en.md', 'utf8');
    const readmeUrls = urlsInReadme(readme);
    const englishReadmeUrls = urlsInReadme(englishReadme);
    if (!readme.includes('[English](README.en.md)')) errors.push('README 缺少英文入口');
    if (!englishReadme.includes('[简体中文](README.md)')) errors.push('README.en.md 缺少中文入口');
    try {
        const englishIndex = await fs.readFile(path.join('versions', 'README.en.md'), 'utf8');
        if (!englishIndex.startsWith('# WeChat Android Version Archive')) errors.push('versions/README.en.md 缺少英文索引标题');
    } catch {
        errors.push('缺少英文版本索引：versions/README.en.md');
    }
    for (const url of duplicates(catalogUrls)) errors.push(`version.json 存在重复 URL：${url}`);
    for (const url of duplicates(readmeUrls)) errors.push(`README 存在重复 URL：${url}`);
    for (const url of new Set(catalogUrls)) if (!readmeUrls.includes(url)) errors.push(`README 缺少 URL：${url}`);
    for (const url of new Set(readmeUrls)) if (!catalogUrls.includes(url)) errors.push(`README 包含未登记 URL：${url}`);
    for (const url of duplicates(englishReadmeUrls)) errors.push(`README.en.md 存在重复 URL：${url}`);
    for (const url of new Set(catalogUrls)) if (!englishReadmeUrls.includes(url)) errors.push(`README.en.md 缺少 URL：${url}`);
    for (const url of new Set(englishReadmeUrls)) if (!catalogUrls.includes(url)) errors.push(`README.en.md 包含未登记 URL：${url}`);

    for (const version of new Set(entries.map(entry => entry.version))) {
        const file = path.join('versions', version, 'README.md');
        try {
            const page = await fs.readFile(file, 'utf8');
            if (!page.startsWith(`# 微信 ${version} Android 历史版本下载`)) errors.push(`${file} 缺少版本标题`);
        } catch {
            errors.push(`缺少版本页面：${file}`);
        }
        const englishFile = path.join('versions', version, 'README.en.md');
        try {
            const page = await fs.readFile(englishFile, 'utf8');
            if (!page.startsWith(`# WeChat ${version} for Android: Historical Download`)) errors.push(`${englishFile} 缺少版本标题`);
        } catch {
            errors.push(`缺少英文版本页面：${englishFile}`);
        }
    }

    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`校验通过（${entries.length} 条下载记录，${new Set(entries.map(entry => entry.version)).size} 个版本）`);
}

main().catch(error => {
    console.error(`校验失败：\n${error.message}`);
    process.exit(1);
});
