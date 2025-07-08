import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';
import { extractPropertyData } from './utils/extractors.js';

await Actor.init();

const input = await Actor.getInput();
let { startUrls = [], datasetId } = input;

if (datasetId && typeof datasetId === 'string' && datasetId.trim().match(/^[a-zA-Z0-9\-]+$/)) {
    const dataset = await Actor.openDataset(datasetId.trim());
    const items = await dataset.getData();
    log.info(`📥 Enriching ${items.items.length} listings from dataset: ${datasetId}`);
    startUrls = items.items
        .map(item => item.url)
        .filter(url => typeof url === 'string')
        .map(url => ({ url }));
} else if (!startUrls.length) {
    throw new Error(`❌ Invalid or missing datasetId: "${datasetId}". Enricher has nothing to do.`);
}

console.log("Start URLs:", startUrls);

const crawler = new PlaywrightCrawler({
    headless: true,
    minConcurrency: 1,
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 300,

    requestHandler: async ({ page, request }) => {
        log.info(`🔎 Enriching: ${request.url}`);

        try {
            await page.goto(request.url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000); // lazy content buffer

            const html = await page.content();
            console.log("📄 HTML snapshot:", html.slice(0, 1000), '...');

            await page.waitForSelector('h1, [data-testid="listing-description"]', {
                timeout: 30000,
                state: 'attached',
            });

            const data = await extractPropertyData(page);

            if (!data?.title) {
                log.warning(`⚠️ No title found on: ${request.url}`);
            }

            await Actor.pushData({
                listing_id: request.url.match(/\/listing\/(\d+)/)?.[1] ?? null,
                url: request.url,
                status: "Active",
                source: "trademe",
                ...data,
            });
        } catch (err) {
            log.error(`❌ Failed on ${request.url}: ${err.message}`);
            await Actor.pushData({
                url: request.url,
                error: err.message,
            });
        }
    },
});

await crawler.run(startUrls);
await Actor.exit();
