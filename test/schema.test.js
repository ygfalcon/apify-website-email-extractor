import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Ajv from 'ajv'
import { buildDatasetItem } from '../src/dataset.js'
import { emptySocials, finalizeContacts } from '../src/extract.js'

const ajv = new Ajv({ strict: false, allErrors: true })
const dataset = JSON.parse(readFileSync(new URL('../.actor/dataset_schema.json', import.meta.url)))
const input = JSON.parse(readFileSync(new URL('../.actor/input_schema.json', import.meta.url)))
const output = JSON.parse(readFileSync(new URL('../.actor/output_schema.json', import.meta.url)))
const pricing = JSON.parse(readFileSync(new URL('../.actor/pricing.json', import.meta.url)))
const validateItem = ajv.compile(dataset.fields)
const validateInput = ajv.compile(input)

function sampleItem(overrides = {}) {
    const finalized = finalizeContacts({
        emailRows: [{
            email: 'jane.doe@acme.dev',
            sources: ['mailto', 'contact'],
            name: 'Jane Doe',
            role: 'Head of Sales',
            roleSource: 'jobTitle',
            phone: '+14155552671',
            mxValid: true,
        }],
        people: [],
        phoneEntries: [{ phone: '+14155552671', source: 'tel' }],
        siteHost: 'acme.dev',
    })
    return buildDatasetItem('https://acme.dev/', {
        ...finalized,
        socials: { ...emptySocials(), linkedin: ['https://www.linkedin.com/company/acme'] },
        pagesScanned: 2,
        pages: ['https://acme.dev/', 'https://acme.dev/contact'],
        finalUrl: 'https://acme.dev/',
        error: null,
        ...overrides,
    }, new Date('2026-10-23T00:00:00.000Z'))
}

test('dataset rows validate against the Store schema', () => {
    const hit = sampleItem()
    const miss = buildDatasetItem('https://empty.test/', {
        emails: [], emailDetails: [], phones: [], socials: emptySocials(), contacts: [],
        bestContact: null, primaryPhone: null, pagesScanned: 1, pages: ['https://empty.test/'],
        finalUrl: 'https://empty.test/', error: null,
    }, new Date('2026-10-23T00:00:00.000Z'))
    const down = buildDatasetItem('https://down.test/', {
        emails: [], emailDetails: [], phones: [], socials: emptySocials(), contacts: [],
        bestContact: null, primaryPhone: null, pagesScanned: 0, pages: [],
        finalUrl: null, error: 'website_unreachable',
    }, new Date('2026-10-23T00:00:00.000Z'))
    for (const item of [hit, miss, down]) {
        assert.equal(validateItem(item), true, JSON.stringify(validateItem.errors, null, 2))
    }
    assert.equal(hit.primaryEmail, 'jane.doe@acme.dev')
    assert.equal(miss.status, 'no_contacts_found')
    assert.equal(down.status, 'website_unreachable')
})

test('input schema still requires urls and accepts the new MX flag', () => {
    assert.deepEqual(input.required, ['urls'])
    assert.equal(input.properties.validateMx.default, true)
    assert.equal(input.properties.maxPagesPerDomain.maximum, 10)
    assert.equal(validateInput({ urls: ['acme.dev'] }), true, JSON.stringify(validateInput.errors))
    assert.equal(validateInput({}), false)
    assert.equal(output.actorOutputSchemaVersion, 1)
    assert.equal(dataset.views.contacts.transformation.fields.includes('contactName'), true)
})

test('price is unchanged', () => {
    assert.equal(pricing.pricingModel, 'PAY_PER_EVENT')
    assert.equal(pricing.events.length, 1)
    assert.equal(pricing.events[0].eventName, 'domain-with-contacts')
    assert.equal(pricing.events[0].priceUsd, 0.0015)
})
