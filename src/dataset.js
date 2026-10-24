import { emptySocials, registrableDomain } from './extract.js'

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i

export function isValidHost(host) {
    return HOST_RE.test(String(host || '').replace(/\.$/, ''))
}

// Returns valid unique start URLs plus the raw entries that are not domains or URLs, so each bad
// row gets its own error item instead of vanishing silently.
export function partitionStartUrls(urls) {
    const list = []
    const invalid = []
    const seen = new Set()
    for (const entry of urls || []) {
        const raw = typeof entry === 'string' ? entry : entry?.url
        if (raw == null || (typeof raw === 'string' && !raw.trim())) continue
        if (typeof raw !== 'string') { invalid.push(String(raw)); continue }
        const value = raw.trim()
        try {
            if (/\s/.test(value)) throw new Error('space')
            const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`)
            if (!/^https?:$/.test(parsed.protocol) || !isValidHost(parsed.hostname)) throw new Error('bad')
            const href = `${parsed.protocol}//${parsed.host}/`
            const key = `${parsed.host.replace(/^www\./i, '').toLowerCase()}`
            if (seen.has(key)) continue
            seen.add(key)
            list.push(href)
        } catch {
            invalid.push(value)
        }
    }
    return { valid: list, invalid }
}

export function normalizeStartUrls(urls) {
    return partitionStartUrls(urls).valid
}

export function buildInvalidItem(input, now = new Date()) {
    const item = buildDatasetItem(input, { error: 'invalid_url' }, now)
    return { ...item, domain: input, url: input }
}

export function domainFromUrl(url) {
    try {
        return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
        return registrableDomain(String(url || '').replace(/^https?:\/\//, '').split('/')[0])
    }
}

export function countSocials(socials) {
    return Object.values(socials || {}).reduce((sum, urls) => sum + (Array.isArray(urls) ? urls.length : 0), 0)
}

export function hasContacts(item) {
    return item.emails.length > 0 || item.phones.length > 0 || countSocials(item.socials) > 0
}

export function buildDatasetItem(startUrl, enriched, now = new Date()) {
    const socials = { ...emptySocials(), ...(enriched.socials || {}) }
    for (const key of Object.keys(socials)) {
        if (!Array.isArray(socials[key])) socials[key] = []
    }
    const emails = enriched.emails || []
    const best = enriched.bestContact || null
    const found = emails.length > 0 || (enriched.phones || []).length > 0 || countSocials(socials) > 0
    let status = 'no_contacts_found'
    if (enriched.error) status = enriched.error
    else if (found) status = 'ok'
    const primary = emails[0] || null
    const primaryDetail = (enriched.emailDetails || []).find((row) => row.email === primary) || null
    return {
        domain: domainFromUrl(enriched.finalUrl || startUrl),
        url: enriched.finalUrl || startUrl,
        status,
        emails,
        primaryEmail: primary,
        primaryEmailSyntaxValid: primary ? true : null,
        primaryEmailMxValid: primary ? (primaryDetail?.mxValid ?? null) : null,
        emailDetails: enriched.emailDetails || [],
        phones: enriched.phones || [],
        primaryPhone: enriched.primaryPhone || null,
        socials,
        contacts: enriched.contacts || [],
        contactName: best?.name ?? null,
        contactRole: best?.role ?? null,
        bestContact: best,
        pagesScanned: enriched.pagesScanned ?? 0,
        pages: enriched.pages || [],
        scrapedAt: now.toISOString(),
    }
}
