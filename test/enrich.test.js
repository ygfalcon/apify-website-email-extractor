import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDatasetItem, hasContacts, normalizeStartUrls } from '../src/dataset.js'
import { clearMxCache, enrichWebsite } from '../src/enrich.js'

function pagesFor(map) {
    return async ({ url }) => {
        const key = url.replace(/\/$/, '')
        const body = map[url] || map[key] || map[`${key}/`]
        if (!body) return { statusCode: 404, headers: { 'content-type': 'text/html' }, body: 'missing', url }
        return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body, url }
    }
}

test('crawls contact and footer pages, validates MX, and stops at the page budget', async () => {
    clearMxCache()
    const fetched = []
    const fetchImpl = async (options) => {
        fetched.push(options.url)
        return pagesFor({
            'https://acme.dev/': `
                <html><body>
                  <footer>
                    <a href="/team">Team</a>
                    <a href="https://www.linkedin.com/company/acme">LinkedIn</a>
                    <a href="https://discord.gg/acme">Discord</a>
                  </footer>
                  write to hello [at] acme [dot] dev
                </body></html>`,
            'https://acme.dev/contact': `
                <html><body>
                  <h1>Jane Doe</h1>
                  <p class="job-title">Head of Sales</p>
                  <a href="mailto:jane.doe@acme.dev">Email</a>
                  <a href="tel:+14155552671">Phone</a>
                  <a href="https://wa.me/14155552671">WhatsApp</a>
                  <a href="https://www.threads.net/@acme">Threads</a>
                </body></html>`,
            'https://acme.dev/team': '<html><p>team@acme.dev</p></html>',
            'https://acme.dev/about': '<html><p>about only</p></html>',
            'https://acme.dev/impressum': '<html><p>legal@acme.dev</p></html>',
        })(options)
    }
    const enriched = await enrichWebsite('acme.dev', {
        maxPages: 3,
        validateMx: true,
        fetchImpl,
        resolveMx: async (domain) => (domain === 'acme.dev' ? [{ exchange: 'mx.acme.dev', priority: 1 }] : []),
        mxCache: new Map(),
    })
    assert.equal(enriched.error, null)
    assert.equal(enriched.pagesScanned, 3)
    assert.ok(fetched.length <= 6, `too many fetches: ${fetched.join(', ')}`)
    assert.equal(enriched.bestContact.email, 'jane.doe@acme.dev')
    assert.equal(enriched.bestContact.name, 'Jane Doe')
    assert.equal(enriched.bestContact.role, 'Head of Sales')
    assert.equal(enriched.bestContact.mxValid, true)
    assert.equal(enriched.bestContact.syntaxValid, true)
    assert.ok(enriched.emails.includes('hello@acme.dev'))
    assert.equal(enriched.socials.linkedin[0], 'https://www.linkedin.com/company/acme')
    assert.equal(enriched.socials.discord[0], 'https://discord.gg/acme')
    assert.equal(enriched.socials.threads[0], 'https://www.threads.net/@acme')
    assert.equal(enriched.socials.whatsapp[0], 'https://wa.me/14155552671')
    assert.equal(enriched.primaryPhone, '+14155552671')
    const item = buildDatasetItem('https://acme.dev/', enriched, new Date('2026-10-23T00:00:00.000Z'))
    assert.equal(item.status, 'ok')
    assert.equal(item.domain, 'acme.dev')
    assert.equal(item.contactName, 'Jane Doe')
    assert.equal(item.primaryEmailSyntaxValid, true)
    assert.equal(item.primaryEmailMxValid, true)
    assert.equal(hasContacts(item), true)
    assert.equal(Object.keys(item.socials).length, 13)
})

test('unreachable domains are a free miss and linktree pages yield socials', async () => {
    const missed = await enrichWebsite('https://down.test/', {
        maxPages: 2,
        validateMx: false,
        fetchImpl: async () => { throw new Error('down') },
        mxCache: new Map(),
    })
    const missItem = buildDatasetItem('https://down.test/', missed, new Date('2026-10-23T00:00:00.000Z'))
    assert.equal(missItem.status, 'website_unreachable')
    assert.equal(hasContacts(missItem), false)
    assert.equal(missItem.primaryEmail, null)
    assert.equal(missItem.bestContact, null)
    assert.equal(missItem.socials.facebook.length, 0)

    const linktree = await enrichWebsite('https://linktr.ee/acme', {
        maxPages: 2,
        validateMx: false,
        fetchImpl: pagesFor({
            'https://linktr.ee/acme': `
                <html>
                  <a href="https://www.instagram.com/acme">ig</a>
                  <a href="https://t.me/acme">tg</a>
                  <a href="https://www.reddit.com/r/acme">r</a>
                  <a href="mailto:hello@acme.dev">mail</a>
                  <a href="https://acme.dev/contact">site</a>
                </html>`,
            'https://acme.dev/contact': '<html><a href="mailto:sales@acme.dev">sales</a></html>',
        }),
        mxCache: new Map(),
    })
    assert.equal(linktree.socials.instagram[0], 'https://www.instagram.com/acme')
    assert.equal(linktree.socials.telegram[0], 'https://t.me/acme')
    assert.equal(linktree.socials.reddit[0], 'https://www.reddit.com/r/acme')
    assert.ok(linktree.emails.includes('sales@acme.dev'))
    assert.ok(linktree.pagesScanned <= 2)
})

test('normalizeStartUrls dedupes www and bare domains', () => {
    assert.deepEqual(normalizeStartUrls(['acme.dev', 'https://www.acme.dev/about', 'not a url', { url: 'https://other.test/path' }]), [
        'https://acme.dev/',
        'https://other.test/',
    ])
})
