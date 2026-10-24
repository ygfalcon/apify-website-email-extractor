import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { Actor, log } from 'apify'
import { clearMxCache, enrichWebsite } from './enrich.js'
import { buildDatasetItem, buildInvalidItem, hasContacts, partitionStartUrls } from './dataset.js'

function clamp(value, min, max, fallback) {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.min(max, Math.max(min, Math.trunc(number)))
}

export function isMainModule() {
    const entry = process.argv[1]
    if (!entry) return false
    return import.meta.url === pathToFileURL(path.resolve(entry)).href
}

const SITE_DEADLINE_MS = 60000

// Hard per-domain limit: one stuck site can never keep the run alive. Timed-out domains are not charged.
export async function enrichWithDeadline(url, options, { deadlineMs = SITE_DEADLINE_MS, engine = enrichWebsite } = {}) {
    let timer
    try {
        return await Promise.race([
            engine(url, options),
            new Promise((resolve) => {
                timer = setTimeout(() => resolve({ error: 'website_timeout' }), deadlineMs)
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}

export async function run() {
    await Actor.init()
    try {
        const input = (await Actor.getInput()) || {}
        const { valid: urls, invalid } = partitionStartUrls(input.urls)
        // Malformed rows get an error item (never charged) so callers can see what was skipped.
        for (const bad of invalid) await Actor.pushData(buildInvalidItem(bad))
        if (invalid.length) log.warning(`${invalid.length} input rows are not valid domains or URLs (status invalid_url, not charged).`)
        if (!urls.length) {
            await Actor.fail('No valid websites in "urls". Add at least one domain (acme.com) or URL (https://acme.com).')
            return
        }
        const maxPages = clamp(input.maxPagesPerDomain, 1, 10, 3)
        const concurrency = clamp(input.concurrency, 1, 50, 20)
        const chargeOnlyHits = input.chargeOnlyHits !== false
        const validateMx = input.validateMx !== false
        const proxyInput = input.proxyConfiguration
        const proxy = proxyInput?.useApifyProxy || proxyInput?.proxyUrls?.length
            ? await Actor.createProxyConfiguration(proxyInput)
            : undefined
        const onPlatform = Boolean(process.env.ACTOR_RUN_ID)
        clearMxCache()
        log.info(`${urls.length} unique domains`)
        let index = 0
        let hits = 0
        let stop = false
        async function worker() {
            while (!stop && index < urls.length) {
                const url = urls[index]
                index += 1
                const enriched = await enrichWithDeadline(url, {
                    proxyUrl: proxy ? await proxy.newUrl() : undefined,
                    maxPages,
                    validateMx,
                })
                const item = buildDatasetItem(url, enriched)
                await Actor.pushData(item)
                if (hasContacts(item)) hits += 1
                if (onPlatform && (hasContacts(item) || !chargeOnlyHits)) {
                    const charged = await Actor.charge({ eventName: 'domain-with-contacts' }).catch(() => null)
                    if (charged?.eventChargeLimitReached) stop = true
                }
            }
        }
        const workers = Math.min(concurrency, urls.length)
        await Promise.all(Array.from({ length: workers }, () => worker()))
        log.info(`Done: ${hits}/${urls.length} domains had contacts.`)
    } finally {
        await Actor.exit()
    }
}

if (isMainModule()) await run()
