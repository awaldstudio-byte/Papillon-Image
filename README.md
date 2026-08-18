# Papillon Image — A WALD STUDIO build

Premium multi-page website concept and production-ready static build for **Papillon Image™ / Helga Jackson**.

## Production routes
- `/` — Home
- `/about` — About Helga
- `/services` — Services, pricing and FAQ
- `/kaleidoscope-colour-analysis`
- `/signature-style-analysis`
- `/wardrobe-edit`
- `/personal-shopping`
- `/make-up-masterclass`
- `/travel-light`
- `/pocket-stylist`
- `/groups-talks`
- `/contact`

Vercel `cleanUrls` is enabled, so the source files remain `.html` while the public URLs stay clean.

## Local preview compatibility
This build is intentionally compatible with **both** deployment and direct local opening. You can double-click `index.html` from the extracted folder and the CSS, fonts, JavaScript, images and internal page links use relative paths, so the designed site should load without running a local server. The same files remain deployable to Vercel; `cleanUrls` can still present public URLs without the `.html` suffix.

## Supplied Papillon material used
- Helga consultation / mirror photograph — main hero and consultation storytelling
- Helga seated portrait — founder/about storytelling
- Colour Swatches image — colour analysis/services storytelling
- Pocket Stylist COLOUR image
- Pocket Stylist STYLE image
- Papillon circular logo mark — navigation, favicon and hero accent
- Papillon full white logo — footer
- Papillon Coral `#F17179`
- Client-supplied Avant Garde font family — converted to WOFF2 for web performance with original TTF fallbacks retained
- Helga's supplied copy, named service system and pricing
- Five supplied 5-star testimonials

The duplicated Facebook/logo exports supplied in several sizes are intentionally not all shown on-page; using every duplicate would repeat the same artwork rather than add value.

## SEO / technical work already included
- Unique title and meta description per route
- Canonical URLs for `www.papillon-image.co.za`
- Open Graph and Twitter metadata
- Semantic heading hierarchy
- `robots.txt`
- XML sitemap
- `ProfessionalService` structured data
- Individual `Service` structured data and ZAR offers where pricing was supplied
- `BreadcrumbList` structured data
- Visible services FAQ + `FAQPage` structured data
- Helga Jackson `Person` structured data on About
- Local relevance for Kempton Park, Johannesburg and Gauteng
- Optimised responsive WebP imagery with JPEG fallbacks
- Local client-supplied fonts with WOFF2 delivery
- Responsive desktop/mobile navigation
- Accessible labels, alt text, keyboard focus and reduced-motion support
- Vercel asset caching/security headers

## QA completed
The build has been browser-rendered at **1440px desktop** and **390px mobile** across all 12 production pages. Automated checks confirmed:
- no horizontal overflow on any tested route
- all images load
- one H1 per page
- no console/page JavaScript errors
- valid local links/assets
- parseable JSON-LD and CSS

See `QA-REPORT.txt` for the route-by-route browser run.

## Items to confirm with Helga before final launch
These were **not supplied clearly enough to invent**:

1. **Google Business / Google Reviews link** — the onboarding form asks A WALD STUDIO for assistance, but no actual Google profile/review URL was supplied. Add this once confirmed.
2. **Service naming:** the onboarding shorthand says `7 Min Make-Up`, while the final website copy deck brands the service as `LET'S FACE IT™ — Make-up Masterclass`. This build follows the detailed copy deck. Confirm whether “7 Min Make-Up” should also appear publicly.
3. **Colour wording:** onboarding shorthand says `Colour Coding`; the detailed copy deck uses `KALEIDOSCOPE™ — Colour Analysis`. This build follows the detailed copy deck.
4. **Packing wording:** onboarding shorthand says `Packing`; the detailed copy deck brands it as `TRAVEL LIGHT™ — Pack Less. Wear More.` This build follows the detailed copy deck.
5. **Contact form delivery:** because no form/email API or SMTP credentials were supplied, the preview currently prepares a completed email to `helga@papillon-image.co.za` in the visitor's email app. Wire the form to the chosen production email/form backend before launch if fully server-side submission is preferred.
6. **Street address:** Helga supplied a physical address during onboarding, but it is not published on the website because the form marked it optional and did not explicitly request public display. The site uses Kempton Park / Johannesburg / Gauteng for local SEO instead.
7. **Canonical host:** the build uses `https://www.papillon-image.co.za` because Helga's copy lists the website with `www`. If the final production preference is the root domain without `www`, change canonicals/sitemap and redirect the other host.
8. **Analytics / Search Console:** IDs/account access were not supplied. Connect these at launch so Helga owns or is primary administrator of the measurement accounts.

## A WALD STUDIO note
This project deliberately treats colour as a sequence rather than simply covering the site in Papillon Coral. Coral remains the primary identity colour, with controlled supporting plum, sky, gold and warm neutral fields to create rhythm while keeping the visual system unmistakably Papillon.


SOCIAL LINKS
------------
WhatsApp: https://wa.me/27827458207
Instagram: https://www.instagram.com/papillon_image/
Facebook: https://www.facebook.com/PapillonImage/

The Instagram handle and Facebook page were supplied by Helga in the onboarding material.
The WhatsApp link is generated from the supplied South African mobile number (+27 82 745 8207).
Facebook was normalised from the supplied Page ID to the public PapillonImage page URL.


A WALD STUDIO CREATOR CREDIT
----------------------------
A restrained "Website by A WALD STUDIO" creator credit appears in the legal footer row on all
public pages and links to https://awaldstudio.com. It is intentionally subtle so Papillon Image
remains the visual focus.
