# Pilot cut (a) — public share page on the free Vercel production URL

Checked on 2026-11-15, anonymous `curl` (no cookie, no Vercel login), from this session:

```
GET https://jefeli-web-habibjallow95-9380.vercel.app/            → 200
<title>Jëfëli — Le réseau social du commerce sénégalais</title>
GET https://jefeli-web-habibjallow95-9380.vercel.app/p/992d61ed-d08f-4f79-8a26-4ee7e794370d → 200
<meta property="og:title" content="Jef meme — 30 000 F CFA"
<meta property="og:description" content="Neuf · À vendre · Dakar. Vendu par Zayd Ahmed."
<meta property="og:url" content="https://jefeli-web-habibjallow95-9380.vercel.app/p/992d61ed-…"
<meta property="og:locale" content="fr_SN"
<meta property="og:image" content="https://gbsoifwllbacwsknydkq.supabase.co/storage/v1/object/public/public-media/…jpg"
CTA href="https://jefeli-app-habibjallow95-9380.vercel.app/p/992d61ed-…"
GET https://jefeli-app-habibjallow95-9380.vercel.app/            → 404 (no READY production deployment; project kept behind Vercel protection — owner declined making it public)
```

- Production deployment: `dpl_EwBT8oMWQosUwq9sbru9A2x7eMhT` (jefeli-web, built from `main` = baseline 4b65ce3), READY.
- Free Hobby `*.vercel.app` URL, no custom domain, no paid service.
- The article above is a real staging listing (not DÉMO-seeded on staging).
- Consequence: the page's « Ouvrir dans l'app » link reaches a protected app deployment for anonymous visitors until the owner decides on the app's protection (see NEXT_ACTIONS).
