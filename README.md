# Website Email & Contact Extractor: emails, phones and socials per domain

Paste websites or bare domains and get **one merged row per domain** with emails (sorted so same-domain addresses come first), phone numbers and social profiles (Facebook, Instagram, LinkedIn, X, TikTok, YouTube, Pinterest). It checks the home page plus contact, about and impressum pages. It's fast because it uses plain HTTP, with no browser.

## Why this one
| | This actor | Typical contact scraper |
|---|---|---|
| Billing | **Only domains where contacts were found** ($1.50 per 1,000 hits) | Every page crawled (~$1–2 per 1,000 pages, often 3–20 pages per site) |
| Output | One row per domain, deduped and merged | One row per page, so you have to merge them yourself |
| Junk filtering | Drops image filenames, placeholder emails and tracking addresses | Varies |
| Pairs with | Our Google Maps Scraper + Emails | — |

## Test run (real, Oct 2026)
31 domains in 33 seconds: 23 returned contacts, 15 returned emails, 6 were unreachable or blocked (free), and 2 had no contacts (free).

## Example output
```json
{
  "domain": "apify.com",
  "url": "https://apify.com/",
  "status": "ok",
  "emails": [
    "support@apify.com",
    "hello@apify.com"
  ],
  "primaryEmail": "support@apify.com",
  "phones": [],
  "socials": {
    "linkedin": [
      "https://www.linkedin.com/company/apify",
      "https://linkedin.com/company/apify"
    ],
    "twitter": [
      "https://x.com/apify"
    ],
    "tiktok": [
      "https://www.tiktok.com/@apifytech",
      "https://www.tiktok.com/@apifyoffice"
    ]
  },
  "pagesScanned": 4
}
```

## Pricing
**domain-with-contacts**: $0.0015. Domains that return nothing aren't charged.
