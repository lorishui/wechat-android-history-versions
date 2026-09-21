const fs = require('fs');
const { isValidPublishDate, isValidVersion, parseOfficialDownloadUrl } = require('./getVersion');

const readmeFilePath = './README.md';
const versionFilePath = './version.json';
const fsPromises = require('fs').promises;
const path = require('path');

function extractUrlsFromReadme(content) {
    const pattern = /^\|[^|]+\|[^|]+\|\s*\[[^\]]+\]\(\s*(https:\/\/[^)\s]+)\s*\)\s*\|/gm;
    const urls = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

function validateVersionEntries(entries, errors) {
    for (const [index, entry] of entries.entries()) {
        if (!isValidVersion(entry.version)) {
            errors.push(`version.json 第 ${index + 1} 条记录包含无效版本号`);
        }
        if (!isValidPublishDate(entry.publish_date)) {
            errors.push(`version.json 第 ${index + 1} 条记录包含无效发布日期`);
        }
        try {
            parseOfficialDownloadUrl(entry.url);
        } catch (error) {
            errors.push(`version.json 第 ${index + 1} 条记录下载地址无效: ${error.message}`);
        }
    }
}

function findDuplicateUrls(urls, label) {
    const seen = new Map();
    const duplicates = [];

    for (const url of urls) {
        seen.set(url, (seen.get(url) || 0) + 1);
    }

    for (const [url, count] of seen.entries()) {
        if (count > 1) {
            duplicates.push(`${label}: ${url} (${count} 次)`);
        }
    }

    return duplicates;
}

async function main() {
    const readme = fs.readFileSync(readmeFilePath, 'utf8');
    const versionEntries = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    const errors = [
        ...findDuplicateUrls(versionEntries.map(entry => entry.url), 'version.json 重复 URL'),
        ...findDuplicateUrls(extractUrlsFromReadme(readme), 'README.md 重复 URL')
    ];
    validateVersionEntries(versionEntries, errors);

    const readmeUrls = new Set(extractUrlsFromReadme(readme));
    const versionUrls = new Set(versionEntries.map(entry => entry.url));
    for (const url of versionUrls) {
        if (!readmeUrls.has(url)) {
            errors.push(`README.md 缺少下载地址: ${url}`);
        }
    }
    for (const url of readmeUrls) {
        if (!versionUrls.has(url)) {
            errors.push(`README.md 包含未登记下载地址: ${url}`);
        }
    }

    const versions = [...new Set(versionEntries.map(entry => entry.version))];
    for (const version of versions) {
        const pagePath = path.join('versions', version, 'README.md');
        try {
            const page = await fsPromises.readFile(pagePath, 'utf8');
            if (!page.startsWith(`# 微信 ${version} Android 历史版本下载`)) {
                errors.push(`${pagePath} 缺少版本号标题`);
            }
        } catch {
            errors.push(`缺少版本页面: ${pagePath}`);
        }
    }

    if (errors.length > 0) {
        console.error('校验失败:');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    console.log(`校验通过（${versions.length} 个版本页面）`);
}

main().catch(error => {
    console.error('校验失败:', error);
    process.exit(1);
});
