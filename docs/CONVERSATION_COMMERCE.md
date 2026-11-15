# Jëfëli — conversation-first commerce (foundation and roadmap)

Jëfëli is a social network with a marketplace, not a store builder. Every profile has an
automatic boutique (its listings). Buying happens **in the conversation**: members talk,
negotiate and agree there. Jëfëli never holds money. Wave, Orange Money, cash or any other
method is agreed between buyer and seller, and Jëfëli does not claim to verify an external
payment.

## What exists today (post-playtest refinement pass)

| Piece | Where | What it does |
|---|---|---|
| Product card message | `messages.kind = 'product'`, `product_id` | One article shown as a card in the thread. Inserted through the normal message RLS policy and insert trigger (membership, blocks, active account, `can_view_product`) |
| « Écrire au vendeur » from a post | `PostCard` (tagged article) and the product page | `message_about_product` opens or reuses the 1-to-1 conversation and drops the product card in it |
| **Multi-article selection** | `apps/mobile/src/components/chat/ProductPicker.tsx` + `sendProductCards()` in `lib/api/messages.ts` | From « + » in a conversation: pick up to 5 articles from the other member's boutique (or your own) and send them as one card each, in order, in a single insert |
| Price offer / counter-offer / barter | `make_offer`, `respond_offer`, `offers.snapshot` | Unchanged. Works on every price mode, including « Prix sur demande » (no displayed price) |
| Agreement | `agreements` (immutable terms, both confirm) | Unchanged. States plainly that Jëfëli holds no funds |
| Flexible pricing | `products.price_mode` (`fixed`, `on_request`, `negotiable`) and `price_xof` (nullable, never 0) | Shown everywhere by `formatListingPrice()` in `@jefeli/shared`. The offer snapshot keeps `price_mode` |

### Why the picker is the "smallest reusable foundation"

- **No new table and no new server state.** A selection is a list of product ids that already
  pass `can_view_product`. Nothing is reserved, priced, totalled or paid.
- **The same id list is the hand-off point** for later features: an order summary or a
  multi-item offer can start from `selected: string[]` without touching the picker.
- **Security is inherited.** Each card is an ordinary `product` message, so blocking, privacy,
  suspensions, moderation (hidden listings) and the message rate limit already apply. There
  is no special write path to secure.

## Deliberately not built (this sprint)

No shopping cart, no checkout, no payment gateway, no stock reservation or inventory
management, no invoices, no seller badges or levels.

## Roadmap (decisions only, not authorised for implementation yet)

These come after live commerce is integrated and verified. Each note says how it can plug in
without coupling.

1. **Smart order summaries and receipts.** A future `order_summaries` row would reference one
   conversation, a list of `{product_id, snapshot, quantity, agreed_amount_xof}` and an
   optional agreement. Both members would confirm it, like agreements today. Build it from the
   picker's id list plus accepted offers, and reuse `private.product_snapshot()` so the summary
   never changes when a listing is edited. A receipt is a read-only view of a confirmed summary.
2. **WhatsApp share of a summary.** Use the existing `wa.me/?text=` share pattern
   (`whatsappLinks` in `apps/mobile/src/lib/share.ts`, `ShareActions` on the web): the text of
   the summary plus a link to it. No WhatsApp API is involved.
3. **Seller invoices.** Generated from confirmed summaries only, on request, kept separate from
   messaging. Legal and tax requirements in Senegal need an owner and legal decision first.
4. **Business assistant (in-app).** It would read the seller's own listings, conversations and
   summaries through the same RLS as the seller, never with a service role. It would suggest
   text and never send or confirm anything on the seller's behalf.
5. **French and Wolof voice interaction.** Builds on voice notes (`messages.kind = 'voice'`,
   expo-audio). Transcription and translation would be an opt-in server function. No audio is
   used without consent.
6. **Authorized WhatsApp Business assistance.** Only with Meta's official Business Platform,
   the owner's approval and a cost decision. It stays separate from in-app messages, and no
   message is mirrored without the member's explicit consent.
7. **Optional seller reputation levels and badges.** These would be derived from completed
   agreements and reviews (both already exist and are gated by RLS), never from votes,
   followers or downvotes. Display only: no ranking boost tied to paid status.

## Coupling rules for future work

- Pricing display goes through `formatListingPrice()` / `hasDisplayedPrice()` only, so a new
  mode is added in one place (plus the `products_price_rules` check).
- Commerce objects reference **snapshots**, never live listing rows.
- Client writes go through RLS policies or SECURITY DEFINER RPCs that call
  `private.require_user()` and check ownership. Error keys map to French copy in
  `packages/shared/src/errors.ts`.
- Nothing in messaging depends on a future summary or invoice table. Those tables point at
  conversations, never the reverse.
