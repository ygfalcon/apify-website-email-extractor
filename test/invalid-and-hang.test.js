import test from 'node:test'
import assert from 'node:assert/strict'
import { partitionStartUrls, buildInvalidItem, hasContacts, normalizeStartUrls } from '../src/dataset.js'
import { extractPage } from '../src/extract.js'
import { fetchHtml } from '../src/enrich.js'
import { enrichWithDeadline } from '../src/main.js'

test('malformed inputs become invalid rows, valid ones pass', () => {
    const { valid, invalid } = partitionStartUrls(['bad url!!', 'acme.com', 'https://www.acme.com/x', 'foo!!', 'ftp://x.com', 'nodot', { url: 'https://ok.io' }, '', 'http://exa mple.com'])
    assert.deepEqual(valid, ['https://acme.com/', 'https://ok.io/'])
    assert.deepEqual(invalid, ['bad url!!', 'foo!!', 'ftp://x.com', 'nodot', 'http://exa mple.com'])
    assert.deepEqual(normalizeStartUrls(['acme.com']), ['https://acme.com/'])
})

test('invalid row has status invalid_url and is not a hit', () => {
    const item = buildInvalidItem('bad url!!')
    assert.equal(item.status, 'invalid_url')
    assert.equal(item.url, 'bad url!!')
    assert.equal(hasContacts(item), false)
})

test('huge base64 does not freeze extraction', () => {
    const html = `<img src="data:image/png;base64,${'A'.repeat(500000)}"><p>${'x'.repeat(300000)}@</p> office@vidadental.com`
    const t0 = Date.now()
    const r = extractPage(html, 'https://vidadental.com/', 'home')
    assert.ok(Date.now() - t0 < 2000)
    assert.ok(r.emails.some((e) => e.email === 'office@vidadental.com'))
})

test('fetchHtml and per-site deadline never hang', async () => {
    assert.equal(await fetchHtml('https://stuck.example/', { timeoutMs: 100, fetchImpl: () => new Promise(() => {}) }), null)
    const r = await enrichWithDeadline('https://stuck.example/', {}, { deadlineMs: 100, engine: () => new Promise(() => {}) })
    assert.equal(r.error, 'website_timeout')
})
