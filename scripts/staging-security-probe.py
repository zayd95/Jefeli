#!/usr/bin/env python3
"""Hosted security probes against jefeli-staging with the PUBLIC key only (changes nothing that
succeeds: every write here must be refused). Usage: security_probe.py <publishable-key-file> [hosted-accounts.json]"""
import json, sys, urllib.request

BASE = "https://gbsoifwllbacwsknydkq.supabase.co"
KEY = open(sys.argv[1]).read().strip()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
results = []


def req(method, path, body=None, headers=None):
    r = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={**H, **(headers or {})})
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read()
            try:
                return res.status, json.loads(raw)
            except Exception:
                return res.status, raw[:80]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:200]


def check(name, ok, detail):
    results.append((name, ok, detail))


# 1. Private tables: nothing readable anonymously (refused, or RLS returns no rows).
for t in ["feedback", "account_settings", "push_tokens", "messages", "conversations", "conversation_members", "offers", "agreements",
          "reports", "staff_roles", "verification_requests", "moderation_actions", "notifications", "blocks", "mutes", "appeals", "story_views"]:
    s, b = req("GET", f"/rest/v1/{t}?select=*&limit=5")
    ok = s in (401, 403) or (s == 200 and b == []) or (isinstance(b, dict) and b.get("code") in ("42501", "PGRST205"))
    check(f"anon read {t}", ok, f"HTTP {s} {b if not isinstance(b, list) else f'{len(b)} rows'}")

# 2. Writes through the API: refused for anonymous callers.
for t, row in [("feedback", {"kind": "bug", "message": "probe", "platform": "web"}), ("posts", {"body": "probe"}), ("stories", {"caption": "probe"}), ("products", {"title": "probe"})]:
    s, b = req("POST", f"/rest/v1/{t}", row, {"Prefer": "return=minimal"})
    check(f"anon insert {t}", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {b}")

# 3. RPCs that act for a member: refused without a session.
for fn, args in [("create_post", {"p_body": "probe", "p_visibility": "public", "p_media": [], "p_product_ids": [], "p_intent": "share"}),
                 ("share_to_status", {"p_post_id": "00000000-0000-0000-0000-000000000000", "p_product_id": None, "p_caption": "", "p_audience": "public"}),
                 ("create_listing", {"p_title": "probe", "p_description": "", "p_price_xof": 1, "p_category_slug": "x", "p_condition": "new", "p_listing_mode": "sale",
                                     "p_quantity": 1, "p_city": "Dakar", "p_neighborhood": "", "p_delivery_options": ["pickup"], "p_delivery_notes": "", "p_media": []}),
                 ("export_my_data", {}), ("list_orphaned_media", {"p_min_age": "1 day", "p_limit": 1})]:
    s, b = req("POST", f"/rest/v1/rpc/{fn}", args)
    msg = json.dumps(b)[:160]
    ok = s in (401, 403, 404) or "not_authenticated" in msg or "42501" in msg or "permission denied" in msg
    check(f"anon rpc {fn}", ok, f"HTTP {s} {msg}")

# 4. The private schema is not exposed.
s, b = req("POST", "/rest/v1/rpc/upload_quota_ok", {})
check("private.upload_quota_ok not exposed", s in (404,) or (isinstance(b, dict) and b.get("code") == "PGRST202"), f"HTTP {s} {json.dumps(b)[:120]}")
s, b = req("GET", "/rest/v1/rpc/validate_listing_voice")
check("private.validate_listing_voice not exposed", s == 404 or (isinstance(b, dict) and b.get("code") == "PGRST202"), f"HTTP {s} {json.dumps(b)[:120]}")

# 5. Storage: no anonymous upload; private bucket not listable or readable.
up = urllib.request.Request(BASE + "/storage/v1/object/public-media/probe/probe.txt", method="POST", data=b"probe", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "text/plain"})
try:
    with urllib.request.urlopen(up, timeout=30) as r:
        check("anon upload public-media", False, f"HTTP {r.status} (upload accepted!)")
except urllib.error.HTTPError as e:
    check("anon upload public-media", e.code in (400, 401, 403), f"HTTP {e.code} {e.read()[:120]!r}")
s, b = req("POST", "/storage/v1/object/list/private-media", {"prefix": "", "limit": 5})
check("anon list private-media", (s == 200 and b == []) or s in (400, 401, 403, 404), f"HTTP {s} {json.dumps(b)[:120] if not isinstance(b, bytes) else b}")
s, b = req("GET", "/storage/v1/object/public/private-media/anything.jpg")
check("private-media not public", s in (400, 403, 404), f"HTTP {s}")

# 6. Public reads still work (the feed and profiles are meant to be public).
s, b = req("GET", "/rest/v1/profiles?select=id,handle&limit=1")
check("anon read public profiles", s == 200 and isinstance(b, list), f"HTTP {s} {len(b) if isinstance(b, list) else b}")
s, b = req("GET", "/rest/v1/post_media?select=id,language,waveform,cues&limit=1")
check("new post_media columns readable", s == 200, f"HTTP {s}")

# 7. Explorer discovery (20261113000100): anonymous callers may browse, never call the two
# SECURITY DEFINER functions; signed-in results only hold visible, active, moderated content.
s, b = req("POST", "/rest/v1/rpc/trending_products", {})
check("anon rpc trending_products refused", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {json.dumps(b)[:120]}")
s, b = req("POST", "/rest/v1/rpc/suggested_sellers", {})
check("anon rpc suggested_sellers refused", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {json.dumps(b)[:120]}")
s, b = req("POST", "/rest/v1/rpc/explore_products", {"p_sort": "price_asc", "p_min_price": 1})
okx = s == 200 and isinstance(b, list) and all(r["status"] == "active" and r["moderation_status"] == "active" and r["price_xof"] is not None for r in b)
prices = [r["price_xof"] for r in b] if isinstance(b, list) else []
check("anon explore_products: active, moderated, priced, sorted", okx and prices == sorted(prices), f"HTTP {s} {len(b) if isinstance(b, list) else b}")

# 8. P1 sprint (20261114000100 / 000200): voice offers only through the RPC, market reads public.
s, b = req("POST", "/rest/v1/rpc/attach_offer_voice", {"p_offer_id": "00000000-0000-0000-0000-000000000000", "p_attachment_path": "x", "p_attachment_meta": {}})
check("anon rpc attach_offer_voice refused", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {json.dumps(b)[:120]}")
s, b = req("POST", "/rest/v1/rpc/explore_market", {"p_categories": ["telephones", "electronique"]})
check("anon explore_market: active, moderated, in aisle", s == 200 and isinstance(b, list) and all(r["status"] == "active" and r["moderation_status"] == "active" and r["category_slug"] in ("telephones", "electronique") for r in b), f"HTTP {s} {len(b) if isinstance(b, list) else b}")
s, b = req("POST", "/rest/v1/rpc/market_counts", {})
check("anon market_counts: counts only", s == 200 and isinstance(b, list) and all(set(r) == {"category_slug", "articles", "sellers"} for r in b), f"HTTP {s} {b if not isinstance(b, list) else len(b)}")
s, b = req("POST", "/rest/v1/messages", {"conversation_id": "00000000-0000-0000-0000-000000000000", "kind": "voice", "offer_id": "00000000-0000-0000-0000-000000000000"}, {"Prefer": "return=minimal"})
check("anon cannot write messages.offer_id", s in (401, 403) or (isinstance(b, dict) and b.get("code") in ("42501", "PGRST204")), f"HTTP {s} {json.dumps(b)[:100]}")

# 9. Pilot cut (20261115000100..400): handover only through the RPC; « Nouveau » exposure and member
# level are server-written; the level is public and read-only (no balance); private helpers are not exposed.
ZERO = "00000000-0000-0000-0000-000000000000"
s, b = req("POST", "/rest/v1/rpc/set_agreement_handover", {"p_agreement_id": ZERO, "p_at": "2030-01-01T10:00:00Z", "p_place": "Marche Sandaga"})
check("anon rpc set_agreement_handover refused", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {json.dumps(b)[:120]}")
for tbl, col, val in [("agreements", "handover_place", "probe"), ("agreements", "handover_at", "2030-01-01T10:00:00Z"),
                      ("products", "new_seller_until", "2099-01-01T00:00:00Z"), ("profiles", "first_listing_at", "2000-01-01T00:00:00Z")]:
    s, b = req("PATCH", f"/rest/v1/{tbl}?id=eq.{ZERO}", {col: val}, {"Prefer": "return=minimal"})
    check(f"anon cannot write {tbl}.{col}", s in (401, 403) or (isinstance(b, dict) and b.get("code") in ("42501", "PGRST204")), f"HTTP {s} {json.dumps(b)[:100]}")
s, b = req("POST", "/rest/v1/rpc/close_competing_offers", {})
check("private.close_competing_offers not exposed", s == 404 or (isinstance(b, dict) and b.get("code") == "PGRST202"), f"HTTP {s} {json.dumps(b)[:100]}")
s, b = req("POST", "/rest/v1/rpc/member_level", {"p_user": ZERO})
check("anon member_level: unknown member gets nothing", s == 200 and b is None, f"HTTP {s} {json.dumps(b)[:100]}")
s, rows = req("GET", "/rest/v1/profiles?select=id&limit=1")
if s == 200 and isinstance(rows, list) and rows:
    s, b = req("POST", "/rest/v1/rpc/member_level", {"p_user": rows[0]["id"]})
    check("anon member_level: level fields only, no balance", s == 200 and isinstance(b, dict) and set(b) == {"level", "key", "deals", "swaps", "partners"}, f"HTTP {s} {json.dumps(b)[:120]}")
s, b = req("POST", "/rest/v1/products", {"title": "probe", "price_xof": 0, "listing_mode": "give", "price_mode": "fixed"}, {"Prefer": "return=minimal"})
check("anon cannot list a gift (price 0)", s in (401, 403) or (isinstance(b, dict) and b.get("code") == "42501"), f"HTTP {s} {json.dumps(b)[:100]}")

if len(sys.argv) > 2:
    accts = json.load(open(sys.argv[2]))
    for role in ("buyer", "seller"):
        a = accts[role]
        s, t = req("POST", "/auth/v1/token?grant_type=password", {"email": a["email"], "password": a["password"]})
        if s != 200:
            check(f"{role} sign-in for discovery probes", False, f"HTTP {s}")
            continue
        HA = {"Authorization": f"Bearer {t['access_token']}"}
        me = t["user"]["id"]
        s, rows = req("POST", "/rest/v1/rpc/trending_products", {"p_limit": 20}, HA)
        okt = s == 200 and isinstance(rows, list) and all(r["status"] == "active" and r["moderation_status"] == "active" and r["seller_id"] != me for r in rows)
        check(f"{role} trending_products: active, moderated, never own", okt, f"HTTP {s} {len(rows) if isinstance(rows, list) else rows}")
        s, rows = req("POST", "/rest/v1/rpc/suggested_sellers", {"p_limit": 20}, HA)
        keys = {"id", "handle", "display_name", "avatar_path", "city", "is_demo", "verification_level", "boutique_name", "active_products"}
        oks = s == 200 and isinstance(rows, list) and all(set(r) == keys and r["id"] != me for r in rows)
        # every suggested seller is a profile this member may read, and none is followed already
        if oks and rows:
            idlist = ",".join(r["id"] for r in rows)
            s2, vis = req("GET", f"/rest/v1/profiles?select=id,status,is_private&id=in.({idlist})", None, HA)
            s3, fol = req("GET", f"/rest/v1/follows?select=followee_id&follower_id=eq.{me}", None, HA)
            followed = {f["followee_id"] for f in fol} if isinstance(fol, list) else set()
            oks = isinstance(vis, list) and len(vis) == len(rows) and all(v["status"] == "active" and not v["is_private"] for v in vis) and not (followed & {r["id"] for r in rows})
        check(f"{role} suggested_sellers: public fields, visible, not followed, never self", oks, f"HTTP {s} {len(rows) if isinstance(rows, list) else rows}")

bad = [r for r in results if not r[1]]
for name, ok, detail in results:
    print(("PASS " if ok else "FAIL ") + name + " — " + detail)
print(f"\n{len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
