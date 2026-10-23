import assert from 'node:assert/strict'
import test from 'node:test'
import {
    SOCIAL_NETWORKS,
    cleanEmail,
    decodeCfEmail,
    deobfuscate,
    extractPage,
    extractSocials,
    finalizeContacts,
    isValidEmailSyntax,
    normalizePhone,
} from '../src/extract.js'

function encodeCf(email, key = 0x42) {
    let hex = key.toString(16).padStart(2, '0')
    for (const char of email) hex += (char.charCodeAt(0) ^ key).toString(16).padStart(2, '0')
    return hex
}

test('social network list matches the Contact Details Scraper set', () => {
    assert.deepEqual(SOCIAL_NETWORKS, [
        'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest',
        'discord', 'snapchat', 'threads', 'telegram', 'reddit', 'whatsapp',
    ])
})

test('syntax validation drops placeholders, files, and broken addresses', () => {
    assert.equal(isValidEmailSyntax('hello@acme.dev'), true)
    assert.equal(isValidEmailSyntax('sales+lead@acme.co.uk'), true)
    assert.equal(isValidEmailSyntax('user@example.com'), false)
    assert.equal(isValidEmailSyntax('sprite@2x.png'), false)
    assert.equal(isValidEmailSyntax('photo@site.jpg'), false)
    assert.equal(isValidEmailSyntax('a@b'), false)
    assert.equal(isValidEmailSyntax('jane..doe@acme.dev'), false)
    assert.equal(isValidEmailSyntax('not-an-email'), false)
    assert.equal(isValidEmailSyntax(`${'a'.repeat(24)}@sentry.io`), false)
    assert.equal(cleanEmail('%20sales@acme.dev'), 'sales@acme.dev')
    assert.equal(cleanEmail('mailto:Sales@Acme.dev?subject=Hi'), 'sales@acme.dev')
})

test('deobfuscates cloudflare, entities, brackets, spaced at/dot, and tag splits', () => {
    const email = 'sales@acme.dev'
    const html = `
        <a href="/cdn-cgi/l/email-protection#${encodeCf(email)}">email</a>
        <span data-cfemail="${encodeCf('hello@acme.dev')}"></span>
        <p>press&#64;acme.dev</p>
        <p>jobs [at] acme [dot] dev</p>
        <p>media (at) acme (dot) dev</p>
        <p>billing at acme dot dev</p>
        <p>info<span>@</span>acme.dev</p>
        <p>in\u200bfo@acme.dev</p>
        <script>var e = "team" + "@" + "acme.dev";</script>
        <p>contact us at acme.dev</p>
    `
    const page = extractPage(html, 'https://acme.dev/', 'home')
    const found = page.emails.map((row) => row.email).sort()
    for (const expected of ['sales@acme.dev', 'hello@acme.dev', 'press@acme.dev', 'jobs@acme.dev', 'media@acme.dev', 'billing@acme.dev', 'info@acme.dev', 'team@acme.dev']) {
        assert.ok(found.includes(expected), `missing ${expected} in ${found.join(', ')}`)
    }
    assert.equal(found.includes('us@acme.dev'), false)
    assert.match(deobfuscate('name [at] domain [dot] test'), /name@domain\.test/)
    assert.equal(decodeCfEmail(encodeCf('a@b.co')), 'a@b.co')
})

test('extracts and canonicalizes all 13 social networks, and drops share links', () => {
    const html = `
        <a href="https://www.facebook.com/AcmeInc">fb</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=https://acme.dev">share</a>
        <a href="https://instagr.am/acme/">ig</a>
        <a href="https://www.instagram.com/p/ABC123/">post</a>
        <a href="https://www.linkedin.com/company/acme/">li</a>
        <a href="http://twitter.com/intent/tweet?text=hi">intent</a>
        <a href="https://twitter.com/Acme">tw</a>
        <a href="https://www.youtube.com/@Acme">yt</a>
        <a href="https://www.tiktok.com/@acme">tt</a>
        <a href="https://www.pinterest.com/acme/">pin</a>
        <a href="https://discord.gg/acme">discord</a>
        <a href="https://www.snapchat.com/add/acme">snap</a>
        <a href="https://www.threads.net/@acme">threads</a>
        <a href="https://t.me/acme">tg</a>
        <a href="https://www.reddit.com/user/acme">reddit</a>
        <a href="https://api.whatsapp.com/send?phone=14155552671">wa</a>
        <a href="https://wa.me/14155552671">wa2</a>
    `
    const socials = extractSocials(html)
    assert.deepEqual(socials.facebook, ['https://www.facebook.com/AcmeInc'])
    assert.deepEqual(socials.instagram, ['https://www.instagram.com/acme'])
    assert.deepEqual(socials.linkedin, ['https://www.linkedin.com/company/acme'])
    assert.deepEqual(socials.twitter, ['https://x.com/Acme'])
    assert.deepEqual(socials.youtube, ['https://www.youtube.com/@Acme'])
    assert.deepEqual(socials.tiktok, ['https://www.tiktok.com/@acme'])
    assert.deepEqual(socials.pinterest, ['https://www.pinterest.com/acme'])
    assert.deepEqual(socials.discord, ['https://discord.gg/acme'])
    assert.deepEqual(socials.snapchat, ['https://www.snapchat.com/add/acme'])
    assert.deepEqual(socials.threads, ['https://www.threads.net/@acme'])
    assert.deepEqual(socials.telegram, ['https://t.me/acme'])
    assert.deepEqual(socials.reddit, ['https://www.reddit.com/user/acme'])
    assert.deepEqual(socials.whatsapp, ['https://wa.me/14155552671'])
})

test('reads name, role, and phone from schema.org and the contact card', () => {
    const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Acme Inc",
          "email": "info@acme.dev",
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "support@acme.dev",
            "telephone": "+1-415-555-0199"
          }
        }
        </script>
        <section class="team">
          <h3>Jane Doe</h3>
          <p class="job-title">Head of Sales</p>
          <a href="mailto:jane.doe@acme.dev">Email Jane</a>
          <a href="tel:+1 (415) 555-2671">Call</a>
        </section>
        <p>John Smith, Founder — john@acme.dev</p>
    `
    const page = extractPage(html, 'https://acme.dev/contact', 'contact')
    const finalized = finalizeContacts({
        emailRows: page.emails.map((row) => ({ ...row, mxValid: true })),
        people: page.people,
        phoneEntries: page.phones,
        siteHost: 'acme.dev',
    })
    const jane = finalized.emailDetails.find((row) => row.email === 'jane.doe@acme.dev')
    const support = finalized.emailDetails.find((row) => row.email === 'support@acme.dev')
    const info = finalized.emailDetails.find((row) => row.email === 'info@acme.dev')
    assert.equal(jane.name, 'Jane Doe')
    assert.equal(jane.role, 'Head of Sales')
    assert.equal(support.role, 'customer support')
    assert.equal(info.role, 'General')
    assert.equal(finalized.bestContact.name, 'Jane Doe')
    assert.equal(finalized.bestContact.email, 'jane.doe@acme.dev')
    assert.equal(finalized.bestContact.mxValid, true)
    assert.ok(finalized.phones.includes('+14155552671'))
    assert.ok(finalized.phones.includes('+14155550199'))
    assert.equal(normalizePhone('2024-2025'), null)
})

test('ranks a named same-domain contact ahead of noreply and free mail', () => {
    const finalized = finalizeContacts({
        emailRows: [
            { email: 'noreply@acme.dev', sources: ['text', 'home'], mxValid: true },
            { email: 'person@gmail.com', sources: ['text', 'home'], mxValid: true },
            { email: 'sales@acme.dev', sources: ['mailto', 'footer'], mxValid: false },
            { email: 'jane.doe@acme.dev', sources: ['mailto', 'contact'], name: 'Jane Doe', role: 'Founder', roleSource: 'jobTitle', mxValid: true },
        ],
        people: [],
        phoneEntries: [],
        siteHost: 'acme.dev',
    })
    assert.deepEqual(finalized.emails, [
        'jane.doe@acme.dev',
        'person@gmail.com',
        'sales@acme.dev',
        'noreply@acme.dev',
    ])
    assert.equal(finalized.bestContact.reasons.includes('mx-valid'), true)
    assert.equal(finalized.bestContact.reasons.includes('named-contact'), true)
})

test('prefers contact and about links, and keeps common probes behind real links', () => {
    const html = `
        <footer>
          <a href="/about">About</a>
          <a href="https://other.test/contact">off site</a>
          <a href="/privacy">Privacy</a>
          <a href="https://linktr.ee/acme">bio</a>
        </footer>
    `
    const page = extractPage(html, 'https://www.acme.dev/', 'home')
    const urls = page.links.map((link) => link.url)
    assert.equal(urls[0], 'https://www.acme.dev/contact')
    assert.ok(urls.includes('https://www.acme.dev/about'))
    assert.ok(urls.includes('https://linktr.ee/acme'))
    assert.equal(urls.includes('https://other.test/contact'), false)
    assert.ok(page.links.find((link) => link.url === 'https://www.acme.dev/about').score
        > page.links.find((link) => link.url === 'https://www.acme.dev/impressum').score)
})
