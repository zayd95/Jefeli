# Jëfëli — Product Requirements (PRD)

## Single-sentence product
A social network built for Senegalese commerce: people discover nearby products and shops through everyday content, form relationships, message sellers, buy or barter, and keep following one another.

## Why it exists
Many merchants already post products through TikTok, Facebook, WhatsApp, Snapchat and other channels but struggle to reach new relevant Senegalese customers. Jëfëli is not a substitute Shopify website: it is a discovery and engagement network that turns content into conversations and commerce.

## Business model and positioning
- Primary: B2C discovery for independent sellers, small boutiques and professional merchants.
- Secondary: C2C used-goods resale and exchange (troc), equally usable by non-professionals.
- Zero inventory/retailer operations owned by platform; users coordinate payment/delivery directly in pilot.
- Basic profile and product listings are free. Possible future revenue: transparent boosted content, sponsored lives, seller insights, not pay-to-post.
- Focus first on buyer interest, seller retention and qualified conversations, not number of shops created.

## Key personas and their jobs
1. **Awa, seller:** already promotes clothing on WhatsApp/TikTok; wants new local demand. Needs fast video/photo post, visible price, status, live, followership, messaging, shareable profile and transparent performance.
2. **Mamadou, occasional seller:** wants to sell a used phone or exchange furniture. Needs honest condition, nearby buyers, private chat, offers, clear terms and safety.
3. **Fatou, buyer:** scrolls for lifestyle/entertainment, discovers product, trusts seller, contacts instantly and follows favorites.
4. **Moderator:** sees reports, checks evidence, restricts unsafe products/abusive accounts, records actions and resolves appeals.

## Information architecture
Bottom navigation: `Accueil` | `Explorer` | `Publier` | `Messages` | `Profil`.
- Home top: brand, search/notifications, 24-hour status bar, contextual feed chips.
- Explorer: searchable people, categories, products, local areas, live streams, secondhand and barter.
- Publish: select `Publication`, `Statut`, `Article`, `Live`; camera/library; tag product from existing listings or create quick listing.
- Messages: chat list, buyer/seller conversations, product-linked messages, price and barter proposals.
- Profile: avatar, bio, city, follow/friend controls, counts, statuses/highlights, posts, lives, **prominent Boutique**, reviews where eligible.

## Content taxonomy
`personal_post`, `product_post`, `story`, `live_session`, `listing`. They share author identity, media primitives, moderation, attribution and report infrastructure. A normal personal post must not force a price or product. Product posts can tag actual listings; no broken product references.

## Essential flows

### Flow 1: seller growth
Seller signs up -> completes profile -> publishes photo/video product with price/city -> appears in own boutique & discovery -> buyer who does not follow sees it -> views seller trust/context -> sends product-linked DM -> seller replies -> seller marks reserved/sold if appropriate -> buyer follows and optionally leaves eligible review.

### Flow 2: secondhand resale
User posts a used item with price, condition, pictures and pickup area -> local buyer discovers, bookmarks, makes price offer -> seller counters/accepts -> participants coordinate directly -> mark transaction finished or cancelled, with accurate platform disclaimers.

### Flow 3: barter
A sees B's product set to `Échange accepté` -> chooses an A-owned listing to offer -> optionally suggests XOF adjustment and which side pays -> B reviews exact product snapshot and counters or accepts -> both see accepted terms -> can mark exchange done or disputed. The app never claims to hold money or guarantee delivery.

### Flow 4: status commerce
Seller posts 24h status showing a new collection -> tags a product -> followers watch -> buyer replies privately -> seller sees a product-context chat -> status expires by time and saved highlights persist if the owner chooses.

### Flow 5: live commerce
Seller starts real live video -> followers receive notifications when enabled -> buyer joins, comments and sees pinned product details -> messages seller -> seller can moderate chat/end broadcast -> session state updates accurately. Must use real streaming backend, not a fake MP4 demo.

### Flow 6: social discovery/sharing
Buyer finds friend or seller with search/follow/invite -> sees posts appropriate to privacy settings -> shares profile/product via system share sheet to WhatsApp/Facebook/etc -> visitor opens public web page without install -> uses app deep link if installed. External friend imports only within official API permissions and privacy rules.

## Scope priorities and boundaries
- **Must exist for social-commerce pilot:** auth, profile, follow, feed, media posts, listing/boutique, search, messaging, statuses, barter, live, moderation, public share pages.
- **No payment custody at pilot:** no escrow, stored balance, in-app wallet, obligatory payment gateway, delivery guarantees.
- **No marketplace-merchant SaaS:** no themes, custom domains, drag-and-drop shop builder, merchant website templates or inventory ERP.
- **No false signals:** no fictitious verified badges, bought reviews, made-up follower counts, fake live audiences, fake completion/escrow claims.
- **No uncontrolled social scraping:** user-controlled sharing and rights-cleared uploads only.

## Trust and restrictions
Phone/email account verification is not equivalent to physical identity or merchandise authenticity. Use distinguishable verification levels; do not attach a badge to a merchant until the defined checks actually complete. Reporting/blocking/content filtering and moderation operations are mandatory. Minimize personal contact/location information; publish approximate seller location only if chosen. Design pilot initially for adults, with an eligibility screen and accurate policy.

## Discovery assumptions to test, not fake metrics
- A locally relevant mix of friends/following, fresh posts, merchant product content and occasional new shops may be more engaging than a chronological catalog.
- Users might buy from a merchant discovered through a regular social post rather than a search result.
- Statuses and live can increase return visits, but streaming costs and moderation load require controlled pilot.
- Cross-sharing existing content may help bring sellers and buyers to platform, but imports are permission-limited.

## Pilot metrics
- Weekly active sellers who publish at least one real piece of content.
- Qualified buyer-to-seller conversations, filtered for spam and self-messages.
- Product discovery -> profile view -> message initiation rates.
- Returning buyers, seller response times (when consent/privacy appropriate), saved items, meaningful watch time.
- Report volume and moderation SLA, upload fail/retry rate, crashes and performance on midrange phones.
- Do not assign fictional baseline numbers; instrument and measure.
