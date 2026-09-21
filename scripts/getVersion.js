const {
    addReadmeRow,
    extractAndroidVersion,
    fetchText,
    officialUpdateApi,
    readCatalog,
    toCatalogEntry,
    writeCatalog
} = require('./catalog');

const officialUpdatesPage = 'https://weixin.qq.com/updates';

async function main() {
    const updatesHtml = await fetchText(officialUpdatesPage);
    const version = extractAndroidVersion(updatesHtml);
    const apiText = await fetchText(officialUpdateApi(version));
    const entry = toCatalogEntry(JSON.parse(apiText));
    const catalog = await readCatalog();

    if (catalog.some(item => item.url === entry.url)) return;

    await writeCatalog([entry, ...catalog]);
    await addReadmeRow(entry);
    process.stdout.write(`${entry.version}\n`);
}

main().catch(error => {
    console.error(`更新检查失败：${error.message}`);
    process.exit(1);
});
