# Papillon Image™ — approved master copy, 7 October 2026

The existing Papillon branding, photographs and five original testimonial quotations are retained. The 7 October 2026 final master supplied by Helga is the content authority.

## Main navigation

Home | About Helga | Services | Pocket Stylist | Talks | Testimonials | FAQ | Contact

The source files remain static HTML. Vercel clean URLs are retained, including the existing service URLs so old links remain usable. Privacy Policy and Terms & Conditions are linked from the footer only. The custom 404 contains the supplied copy.

## Content implementation

- Exact supplied copy and SEO titles/descriptions for all eight main pages.
- Current pricing and service names on all service/detail pages.
- Same-day Colour & Style Experience, including its R700 saving.
- Kempton Park location and approved public travel terms.
- Pocket Stylist clearly positioned as a third-party supporting tool.
- Original testimonial quotations and attributions unchanged.
- Existing verified contact destinations retained: WhatsApp +27 82 745 8207, helga@papillon-image.co.za and instagram.com/papillon_image/.
- Existing Papillon favicon and brand mark used for social sharing.
- Meaningful image alt text, reduced-motion support and content available without reveal-script execution.
- No analytics, marketing pixels, remote fonts or website-added tracking cookies.

## Contact delivery

The optional Vercel function at `/api/contact` sends enquiries to the fixed Helga mailbox via Purelymail SMTP with validated Reply-To. It requires private Vercel environment variables:

- `SMTP_USER`: the full authorised Purelymail sending mailbox address.
- `SMTP_PASS`: that mailbox’s password, or app password where required.

Enter credentials privately in Vercel, never in source control, then redeploy. No account password should be reset merely to configure this form.

Without valid configuration, the page preserves its clearly labelled email-app workflow. It does not claim a message was sent merely because an email was prepared. WhatsApp and direct email remain available. With configuration, the approved success copy is shown only after SMTP accepts the message; SMTP acceptance is not a delivery/read receipt.

The backend uses fixed recipient/SMTP host, TLS verification, field and body limits, a honeypot, same-origin checks, deadlines and a small in-instance burst guard. The guard is not distributed or durable; hosting/provider abuse controls may be needed if abuse occurs. No credential or enquiry content is logged. There are no automatic retries after an uncertain send.

## Verification

Run `npm test` for backend and frontend tests. Tests use fake SMTP/fetch; they never send real email.

Browser checks cover desktop (1440×1000), mobile (390×844), one H1, overflow, loaded images, navigation, FAQ and all 17 page states. These viewport checks are not physical-device or Safari certification. The independent source audit checks exact copy, pricing, SEO, local links/fragments, testimonial preservation and privacy/footer placement.

## Outstanding decisions

The master lists Masterclass prices for both 6–10 and 10+ attendees, which overlap at exactly 10. Its supplied wording is retained pending clarification; bookings remain enquiry-based and no automatic charge is made.

Live direct-send delivery cannot be certified until the owner privately configures SMTP and an authorised end-to-end test is completed. No DNS, mailbox credentials or other client domains are changed by this release.
