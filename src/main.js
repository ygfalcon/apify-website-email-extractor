import { Actor, log } from 'apify';
import { enrichWebsite } from './contacts.js';

await Actor.init();
const { urls = [], maxPagesPerDomain = 3, concurrency = 20, chargeOnlyHits = true, proxyConfiguration: pc } = (await Actor.getInput()) || {};
const proxy = pc?.useApifyProxy || pc?.proxyUrls ? await Actor.createProxyConfiguration(pc) : undefined;
const list = [...new Set(urls.map((u) => (typeof u === 'string' ? u : u.url)).filter(Boolean).map((u) => {
    try { const x = new URL(u.startsWith('http') ? u : `https://${u}`); return `${x.protocol}//${x.host}/`; } catch { return null; }
}).filter(Boolean))];
if (!list.length) throw new Error('Provide at least one URL or domain in "urls"');
log.info(`${list.length} unique domains`);
const onPlatform = !!process.env.ACTOR_RUN_ID; let i = 0; let hits = 0;
async function worker() {
    while (i < list.length) {
        const url = list[i++];
        const e = await enrichWebsite(url, { proxyUrl: proxy ? await proxy.newUrl() : undefined, maxPages: Math.min(Math.max(1, maxPagesPerDomain), 10) });
        const found = e.emails.length + e.phones.length + Object.keys(e.socials).length;
        const item = { domain: new URL(url).hostname.replace(/^www\./, ''), url, status: e.error || (found ? 'ok' : 'no_contacts_found'),
            emails: e.emails, primaryEmail: e.emails[0] || null, phones: e.phones, socials: e.socials, pagesScanned: e.pagesScanned, scrapedAt: new Date().toISOString() };
        await Actor.pushData(item);
        if (found) hits++;
        if (onPlatform && (found || !chargeOnlyHits)) await Actor.charge({ eventName: 'domain-with-contacts' }).catch(() => {});
    }
}
await Promise.all(Array.from({ length: Math.min(concurrency, 50) }, worker));
log.info(`Done: ${hits}/${list.length} domains had contacts.`);
await Actor.exit();
