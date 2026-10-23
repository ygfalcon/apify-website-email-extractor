# Website Email & Contact Extractor

Paste websites or bare domains and get **one row per domain**. Each row has de-obfuscated emails, syntax and MX checks, phone numbers, a ranked contact (name and role when the page states them), and profile links for the same 13 networks [Contact Details Scraper](https://apify.com/vdrmota/contact-info-scraper) publishes.

It fetches the home page, then contact, about, impressum, and footer links, using plain HTTP. No browser.

## What you get
- Emails from the page, `mailto:` links, JSON-LD, Cloudflare obfuscation, `[at]` / `(dot)` text, HTML entities, and addresses split across tags
- Syntax validation, then an MX lookup (cached, short timeout, no paid verification API)
- Phones from `tel:` links, schema.org, WhatsApp links, and formatted text
- Social profiles: Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Discord, Snapchat, Threads, Telegram, Reddit, WhatsApp
- Name and role from schema.org `Person` / `ContactPoint` and from the card around the address. Inbox addresses such as `sales@` are labeled Sales when the page has no title
- One ranked contact per domain. Same-domain named people outrank `noreply@` and free-mail addresses. Addresses whose domain has no MX record sink
- Duplicates removed. One consistent set of fields on every row, including misses

## Why this one
| | This actor | Contact Details Scraper (`vdrmota/contact-info-scraper`) |
|---|---|---|
| Billing | **$0.0015 per domain with a contact**. Misses are free | From $1.05 / 1,000 pages, including pages with nothing on them |
| Shape | One row per domain | One row per page unless merge is enabled |
| Email check | Syntax plus MX on every kept address | Regex extraction. Full verification is a paid leads add-on |
| Name and role | Read from the page and schema.org | Employee names and titles are a separate leads-enrichment add-on |
| Socials | The same 13 networks, canonicalized and deduped | The same 13 networks. Profile enrichment is billed per profile |
| Runtime | HTTP only, 256 MB | Browser optional, and every extra page is a charge |

A 100-domain run that finds contacts on 70 domains costs **$0.105** here. The same 100 domains at 3 pages each is about **$0.315** on Contact Details Scraper before any add-on, whether or not a contact was found.

## Per-run cost
The Store price is unchanged: **`domain-with-contacts` = $0.0015**. Platform usage is included in that price for Store users. The underlying cost of a run, which the event has to cover, stays small because the actor never starts a browser and defaults to 256 MB.

For 100 domains at 256 MB, concurrency 20, and up to 3 pages:

| Piece | Estimate |
|---|---|
| Compute | 0.25 GB for ~40s ≈ 0.0028 CU × $0.20 ≈ **$0.0006** |
| Transfer | ~150 KB × 3 pages × 100 ≈ 0.044 GB × $0.20 ≈ **$0.009** |
| Dataset writes | 100 × $0.005 / 1,000 ≈ **$0.0005** |
| MX lookups | DNS only, no vendor fee |
| **Platform total** | **about $0.01 per 100 domains** |

At a 70% hit rate the customer pays `70 × $0.0015 = $0.105`. Developer revenue is 80% of that ($0.084) against about $0.01 of platform cost.

## Example output
```json
{
  "domain": "acme.test",
  "url": "https://acme.test/",
  "status": "ok",
  "emails": ["jane.doe@acme.test", "hello@acme.test"],
  "primaryEmail": "jane.doe@acme.test",
  "primaryEmailSyntaxValid": true,
  "primaryEmailMxValid": true,
  "phones": ["+14155552671"],
  "primaryPhone": "+14155552671",
  "contactName": "Jane Doe",
  "contactRole": "Head of Sales",
  "socials": {
    "linkedin": ["https://www.linkedin.com/company/acme"],
    "twitter": ["https://x.com/acme"]
  },
  "pagesScanned": 3
}
```

`socials` always contains all 13 network keys. Empty arrays are omitted in this excerpt.

## Pricing
**domain-with-contacts**: $0.0015. Domains that return nothing, and domains that do not load, are not charged.
