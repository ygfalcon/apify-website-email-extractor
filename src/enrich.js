import { promises as dns } from 'node:dns'
import { gotScraping } from 'got-scraping'
import {
    extractPage,
    finalizeContacts,
    hostFromUrl,
    mergeSocials,
    pageKindFromUrl,
} from './extract.js'

const mxCache = new Map()

export function clearMxCache() {
    mxCache.clear()
}

export async function checkMx(domain, { resolveMx = dns.resolveMx, timeoutMs = 1500, cache = mxCache } = {}) {
    const key = String(domain || '').toLowerCase()
    if (!key) return null
    if (cache.has(key)) return cache.get(key)
    const pending = (async () => {
        try {
            const records = await Promise.race([
                resolveMx(key),
                new Promise((_, reject) => {
                    const error = new Error('timeout')
                    error.code = 'ETIMEOUT'
                    setTimeout(() => reject(error), timeoutMs)
                }),
            ])
            return Array.isArray(records) && records.length > 0
        } catch (error) {
            const code = error?.code
            if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ENODOMAIN') return false
            return null
        }
    })()
    cache.set(key, pending)
    return pending
}

export async function fetchHtml(url, { proxyUrl, timeoutMs = 12000, fetchImpl = gotScraping } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetchImpl({
                url,
                proxyUrl,
                timeout: { request: timeoutMs },
                followRedirect: true,
                retry: { limit: 0 },
                throwHttpErrors: false,
                headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
            })
            const status = response.statusCode ?? response.status
            const headers = response.headers || {}
            const type = String(headers['content-type'] || headers['Content-Type'] || '')
            const body = String(response.body ?? '')
            if (status >= 400 && status < 500) return null
            const looksHtml = type.includes('html') || type.includes('xml') || (!type && body.includes('<'))
            if (status < 400 && looksHtml && body.includes('<')) {
                return { html: body.slice(0, 1_500_000), finalUrl: response.url || url }
            }
            if (status >= 500) continue
            return null
        } catch {
            // One retry covers a dropped connection. 4xx is not retried.
        }
    }
    return null
}

async function openHomepage(url, fetchOptions) {
    const first = await fetchHtml(url, fetchOptions)
    if (first) return first
    if (url.startsWith('https://')) return fetchHtml(url.replace('https://', 'http://'), fetchOptions)
    return null
}

export async function enrichWebsite(website, {
    proxyUrl,
    maxPages = 3,
    validateMx = true,
    mxTimeoutMs = 1500,
    resolveMx,
    fetchImpl,
    mxCache: cache,
} = {}) {
    const empty = {
        emails: [],
        emailDetails: [],
        phones: [],
        socials: mergeSocials([]),
        contacts: [],
        bestContact: null,
        primaryPhone: null,
        pagesScanned: 0,
        pages: [],
        finalUrl: null,
        error: null,
    }
    if (!website) {
        empty.error = 'invalid_url'
        return empty
    }
    let start
    try {
        start = website.startsWith('http') ? new URL(website) : new URL(`https://${website}`)
    } catch {
        empty.error = 'invalid_url'
        return empty
    }
    const fetchOptions = { proxyUrl, fetchImpl }
    const home = await openHomepage(start.href, fetchOptions)
    if (!home) {
        empty.error = 'website_unreachable'
        return empty
    }

    const pageBudget = Math.min(Math.max(1, maxPages), 10)
    const seen = new Set()
    const queue = []
    const emailRows = []
    const people = []
    const phoneEntries = []
    const socialLists = []
    const pages = []
    const startHost = hostFromUrl(home.finalUrl)
    const startIsLinktree = pageKindFromUrl(home.finalUrl) === 'linktree'

    const consume = (page, kind) => {
        const extracted = extractPage(page.html, page.finalUrl, kind)
        emailRows.push(...extracted.emails.map((row) => ({ ...row, mxValid: null })))
        people.push(...extracted.people)
        phoneEntries.push(...extracted.phones)
        socialLists.push(extracted.socials)
        pages.push(page.finalUrl)
        for (const link of extracted.links) {
            if (kind === 'linktree' && !startIsLinktree) continue
            if (seen.has(link.url)) continue
            queue.push(link)
        }
    }

    seen.add(home.finalUrl)
    consume(home, startIsLinktree ? 'linktree' : 'home')

    let extra = 0
    let attempts = 0
    const attemptCap = pageBudget + 3
    while (extra < pageBudget - 1 && attempts < attemptCap && queue.length) {
        queue.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
        const batch = []
        while (batch.length < Math.min(4, pageBudget - 1 - extra) && queue.length && attempts + batch.length < attemptCap) {
            const next = queue.shift()
            if (!next || seen.has(next.url)) continue
            seen.add(next.url)
            batch.push(next)
        }
        if (!batch.length) break
        attempts += batch.length
        const fetched = await Promise.all(batch.map(async (link) => ({
            link,
            page: await fetchHtml(link.url, fetchOptions),
        })))
        for (const { link, page } of fetched) {
            if (!page || extra >= pageBudget - 1) continue
            extra += 1
            const kind = pageKindFromUrl(page.finalUrl || link.url)
            consume(page, kind === 'other' ? (link.family === 'other' ? 'other' : link.family) : kind)
        }
    }

    if (validateMx) {
        const domains = [...new Set(emailRows.map((row) => row.email.split('@')[1]).filter(Boolean))]
        const lookups = new Map(await Promise.all(domains.map(async (domain) => [
            domain,
            await checkMx(domain, { resolveMx, timeoutMs: mxTimeoutMs, cache }),
        ])))
        for (const row of emailRows) row.mxValid = lookups.get(row.email.split('@')[1]) ?? null
    }

    const finalized = finalizeContacts({ emailRows, people, phoneEntries, siteHost: startHost })
    return {
        ...empty,
        ...finalized,
        socials: mergeSocials(socialLists),
        pagesScanned: pages.length,
        pages,
        finalUrl: home.finalUrl,
        error: null,
    }
}
