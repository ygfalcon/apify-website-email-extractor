# 📧 Website Email & Contact Extractor: Emails, Phones, Socials per Domain

**Paste a list of websites, get one clean contact row per domain.** Emails (including obfuscated ones), phone numbers, the best person to contact with their name and role when the site lists them, and 13 social networks, at **$0.0015 per domain where something is found. Misses are free.**

## 🎯 Who it's for
- **Sales and growth teams** enriching a list of company domains before outreach
- **Agencies** turning prospect websites into contactable leads
- **Recruiters, PR and partnership teams** finding the right inbox at each company
- **Data teams and AI agents** that need a cheap, fast enrichment step via the API, after Google Maps, a CRM export or a list of domains

## 🚀 Why this one
- 💸 **Pay only for hits.** You're charged only for domains where at least one email, phone or social profile was found. Dead sites and empty pages cost nothing.
- 🧹 **One row per domain, not per page.** Results are deduplicated and merged, and every row has the same fields, including misses. They're ready for a spreadsheet or CRM import.
- 🕵️ **Finds hidden emails.** It handles `mailto:` links, JSON-LD, Cloudflare email obfuscation, `name [at] domain (dot) com`, HTML entities and addresses split across tags.
- ✅ **Checked, not just scraped.** Every address is syntax-validated and then checked for an MX record (DNS only, no paid verification API), so addresses on dead domains sink to the bottom.
- 🏆 **A ranked best contact.** Named people at the company's own domain outrank `noreply@` and free-mail addresses. Name and role come from schema.org and from the text around the address, and inboxes like `sales@` are labeled.
- 🌐 **13 social networks:** Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Discord, Snapchat, Threads, Telegram, Reddit and WhatsApp, canonicalized and deduplicated.
- ⚡ **Lightweight and fast.** It uses plain HTTP with no browser, defaults to 256 MB and checks 20 domains in parallel. It scans the home, contact, about, impressum and footer-linked pages.

## ⚡ Quick start
1. Paste domains or URLs into **Websites or domains**, one per line (`acme.com` or `https://acme.com/about` both work).
2. Click **Start**.
3. Export to CSV, Excel or JSON, or pull the dataset over the API.

```json
{ "urls": ["apify.com", "stripe.com", "basecamp.com"] }
```

## 📊 Sample output (real run, 23 Oct 2026)
This is one row from a local run on the three domains above, with empty social networks and the per-address detail arrays left out of the excerpt. MX checking was turned off for this local run (`validateMx: false`), so `mxValid` shows `null` here. With the default setting on, it is `true` or `false`.

```json
{
  "domain": "apify.com",
  "url": "https://apify.com/",
  "status": "ok",
  "emails": ["support@apify.com", "hello@apify.com"],
  "primaryEmail": "support@apify.com",
  "primaryEmailSyntaxValid": true,
  "primaryEmailMxValid": null,
  "phones": [],
  "primaryPhone": null,
  "socials": {
    "linkedin": ["https://www.linkedin.com/company/apify"],
    "twitter": ["https://x.com/apify"],
    "tiktok": ["https://www.tiktok.com/@apifytech", "https://www.tiktok.com/@apifyoffice"],
    "discord": ["https://discord.gg/jyEM2PRvMU", "https://discord.gg/w3e2v7rWDw"]
  },
  "contactRole": "customer support",
  "bestContact": {
    "email": "support@apify.com",
    "role": "customer support",
    "roleSource": "contactType",
    "reasons": ["same-domain", "role-inbox", "schema", "contact-page", "role"]
  },
  "pagesScanned": 3,
  "pages": ["https://apify.com/", "https://apify.com/contact", "https://apify.com/contact-sales"]
}
```

In the same run, `stripe.com` returned a phone number and five social networks, and `basecamp.com` returned a founder-role email from its About page.

## 💵 Pricing, in plain English
| Event | When it's charged | Price |
|---|---|---|
| `domain-with-contacts` | A domain where at least one email, phone or social profile was found | **$0.0015** |

That's **$1.50 per 1,000 domains with results**, and nothing for the rest. For example, 100 domains with contacts found on 70 cost $0.105. Platform usage is included.

## 💡 Use cases
- Enrich a list of company domains with emails and LinkedIn pages before a cold-email campaign
- Chain after a Google Maps or directory scraper to add contacts to local business leads
- Clean up a CRM: find missing phones, socials and a general inbox for each account
- Find press, partnerships or sales inboxes across a list of brands
- Pull Impressum contacts for German, Austrian and Swiss companies
- Give an AI agent a fast contact lookup tool through the Apify API or MCP server

## ❓ FAQ
**Do I pay for domains where nothing is found?**
No. Domains that return nothing, or that don't load, aren't charged.

**How many pages does it scan per domain?**
The home page plus contact, about and impressum pages, 3 by default and up to 10. Set it with **Max pages per domain**.

**Is the MX check a full email verification?**
No. It confirms the email's domain can receive mail. It doesn't check that the individual mailbox exists, and it never calls a paid verification API.

**Does it work on JavaScript-heavy sites?**
It uses plain HTTP and doesn't render JavaScript, which keeps it fast and cheap. Contacts that only appear after scripts run may be missed.

**Can I use it from code, Zapier or an AI agent?**
Yes. Use the Apify API, the JavaScript/Python clients, Zapier, Make or the Apify MCP server.

**Is it legal?**
It reads publicly published contact information. You're responsible for using it lawfully (GDPR, CAN-SPAM and similar laws).

---
*Keywords: email extractor, website email scraper, contact info scraper, email finder by domain, bulk email finder, domain to email, phone number extractor, social media link scraper, LinkedIn company page finder, lead enrichment, contact details scraper, impressum scraper.*
