# Porting Roadmap — CM02 → oscal

**Perspective:** CM02 side. Authored 2026-05-23 by Claude Opus 4.7 working
from `/Users/daviddoolin/src/CM02` with read access to
`/Users/daviddoolin/src/oscal`.

**Goal:** Absorb every CM02 capability into the oscal Ruby gem so CM02 can
be retired. Independent oscal-side and Codex 5.5 evaluations will follow.

## Decisions already locked in

| Decision | Choice |
|---|---|
| Form scope | **Generic** — render any 800-53 control, not CM-02 only |
| Deploy target | **AWS Lambda** (Ruby 3.3 runtime) |
| Repo shape | **Single repo, gem + app modes** (no split, no monorepo) |

## Capability gap (what CM02 has, oscal lacks)

| Capability | CM02 (Node.js) | oscal (Ruby) |
|---|---|---|
| OSCAL document reader (7 types) | ❌ (catalog extraction only) | ✅ `lib/*.rb` parsers |
| OSCAL document editor / TUI | ❌ | ✅ TreeNavigator + SheetModel |
| OSCAL artifact generator from CI evidence | ✅ `lib/oscal.js` | ❌ |
| Tool-output adapters (npm-audit, Trivy, gitleaks) | ✅ | ❌ |
| Evidence manifest + drift verification | ✅ | ❌ (static reference only) |
| Golden CI pipeline (secrets/SBOM/vuln/OSCAL/verify) | ✅ | ❌ (single rake job) |
| SBOM (CycloneDX) in CI | ✅ | ❌ |
| Vuln scanning in CI (Trivy + dep audit) | ✅ | ❌ |
| Secrets scanning (gitleaks) | ✅ | ❌ |
| Provenance attestation (Solana on-chain) | ✅ | ❌ |
| Audit log | ✅ | ❌ |
| SSDF gap analysis | ✅ | ❌ |
| Web form / HTTP surface | ✅ | ❌ |
| PDF generation | ✅ pdfkit | ❌ |
| Rate limiting | ✅ | ❌ |
| S3 upload + presigned URLs | ✅ | ❌ |
| Lambda packaging + deploy | ✅ | ❌ |
| Multiple catalogs (800-53, SSDF, STIG) | ❌ (only 800-53) | ✅ |

## Target architecture

```
oscal/                              # single repo, post-merge
├── lib/oscal/
│   ├── catalog.rb, ssp.rb, …        # existing OSCAL parsers
│   ├── generator/                   # NEW: OSCAL artifact generators
│   │   ├── assessment_results.rb
│   │   ├── component_definition.rb
│   │   ├── ssp_fragment.rb
│   │   └── adapters/                # npm_audit, trivy, gitleaks, bundler_audit, cyclonedx
│   ├── evidence_manifest.rb         # NEW
│   ├── evidence_verifier.rb         # NEW
│   ├── audit_log.rb                 # NEW
│   ├── rate_limit.rb                # NEW
│   ├── s3_upload.rb                 # NEW (aws-sdk-s3)
│   └── pdf/                         # NEW: Prawn-based renderer
│       ├── control_form.rb          # generic any-control renderer
│       └── theme.rb
├── app/                             # NEW: Sinatra web app
│   ├── server.rb                    # Rack/Sinatra entry
│   ├── handler.rb                   # Lambda entry (via lamby)
│   ├── views/                       # ERB
│   └── public/
├── exe/
│   ├── oscal, oscal_cli             # existing
│   ├── oscal-generate               # NEW
│   ├── oscal-verify-evidence        # NEW
│   └── oscal-serve                  # NEW: local dev server
├── data/                            # existing catalogs + (generated) cicd evidence
├── terraform/                       # NEW: ported from CM02
├── scripts/
│   ├── xccdf_to_oscal.py            # existing
│   ├── attest.rb                    # NEW: Solana attestation
│   └── deploy.rb                    # NEW: package + Lambda update
└── .github/workflows/
    ├── golden-pipeline.yml          # NEW: reusable
    └── ci-cd.yml                    # NEW: consumer + deploy
```

## Tech choices (recommended defaults)

| Concern | Pick | Why |
|---|---|---|
| Web framework | **Sinatra** | Routing + ERB + helpers, minimal deps. Roda viable. |
| PDF library | **Prawn** + prawn-table | Direct Ruby analog of pdfkit. MIT. Mature. |
| Rack-on-Lambda | **lamby** | De-facto adapter; drops `event` into a Rack env. |
| AWS SDK | **aws-sdk-s3** | Modular gem (~5MB cold start). Skip the umbrella. |
| Web tests | **Rack::Test** + RSpec | Existing test framework. |
| Ruby version | **bump to 3.3.0** | Match Lambda runtime; gemspec currently 3.2. |

## Phasing — two parallel tracks

```
Track A (cutover-critical): Phase 3 → 4 → 5 ────────────────┐
                                                              ├─→ Phase 8 (cutover, retire CM02)
Track B (compliance pipeline): Phase 1 → 2 → 6 → 7 ──────────┘
```

---

### Phase 1 — OSCAL artifact generators (Track B)

Port `lib/oscal.js` (~14k LOC) and `scripts/generate-oscal.js` to Ruby.

**Files**
- `lib/oscal/generator/{assessment_results,component_definition,ssp_fragment}.rb`
- `lib/oscal/generator/adapters/{npm_audit,trivy,gitleaks,bundler_audit,cyclonedx}.rb`
- `exe/oscal-generate <evidence-dir>` — writes the three OSCAL JSON docs

**Deps added** — none (stdlib JSON + SecureRandom).

**Tests** — 1:1 with `test/oscal.test.js`; ~20 RSpec examples.

**Done when** — running `oscal-generate` on a CM02 evidence bundle produces
byte-equivalent OSCAL (modulo UUIDs/timestamps).

### Phase 2 — Evidence manifest + verifier (Track B)

**Files**
- `lib/oscal/evidence_manifest.rb` — SHA-256 hashing + schema
- `lib/oscal/evidence_verifier.rb` — drift / completeness checks
- `exe/oscal-verify-evidence <dir>`

Migrate `data/cicd/evidence-manifest.json` from hand-curated to generated.

**Done when** — generated manifest passes verifier; CI uploads it as artifact.

### Phase 3 — PDF form generator (Track A, riskiest port)

Port `lib/cm02Pdf.js` (9.5k, pdfkit) to **Prawn**, generalized: render
any control from `data/NIST_SP-800-53_rev5_catalog.json`, not just CM-02.

**Files**
- `lib/oscal/pdf/control_form.rb` — takes a `Catalog::Control` + a
  `ResponseStore` and emits a PDF stream
- `lib/oscal/pdf/theme.rb` — fonts, colors, table styles

**Layout** — header (system name, control ID, status), one table per part
(ODP, items, examine, interview, test), ODP substitution rendered inline.

**Deps added** — `prawn`, `prawn-table` (both runtime).

**Tests** — golden-file comparison vs CM02-generated PDF for CM-02. Plus
rendering smoke tests for AC-1, SI-4 to prove generality.

**Risk** — Prawn ≠ pdfkit; fonts, line-wrapping, table cells will differ.
Budget time for visual QA.

**Done when** — rendered CM-02 PDF is visually equivalent to current CM02
output; AC-1 and CM-08 render correctly.

### Phase 4 — Web app (Track A, biggest LOC)

**Files**
- `app/server.rb` — Sinatra. Routes:
  - `GET /` — control picker (catalog + control selector)
  - `GET /forms/:control_id` — dynamic form rendered from OSCAL parts
  - `POST /api/forms/:control_id` — generate PDF, upload to S3, return URL
  - `GET /healthz`
- `app/views/form.erb` — generic form template; iterates over `control.parts`
- `lib/oscal/rate_limit.rb` — port of `lib/rateLimit.js`
- `lib/oscal/audit_log.rb` — port of `lib/auditLog.js`
- `lib/oscal/s3_upload.rb` — port of `lib/s3Upload.js`
- `exe/oscal-serve` — `rackup app/config.ru`, port-fallback like `serve.js`

**Deps added** — `sinatra`, `aws-sdk-s3`; `rack-test` (dev).

**Tests** — Rack::Test for all routes; rate-limit + audit-log unit tests.

**Done when** — `bundle exec oscal-serve`, fill CM-02 in browser, get a
presigned URL that downloads a working PDF. Same UX as `npm start`
today. Also works for ≥2 non-CM-02 controls.

### Phase 5 — Lambda packaging + deploy (Track A)

**Files**
- `app/handler.rb` — `Lamby.handler($app)` pattern
- `scripts/deploy.rb` — zip gem + app + vendored gems; `aws lambda update-function-code`

**Update `form-terra`** (separate repo):
- Lambda runtime: `nodejs20.x` → `ruby3.3`
- Handler: `index.handler` → `app/handler.AwsLambdaHandler`
- Keep API Gateway routes; keep `inventium-artifacts` S3 bucket and IAM
  policy attachment

**Deps added** — `lamby` (runtime).

**Risk** — Ruby cold start ~800ms-1.2s vs Node ~200ms. Acceptable for the
form workload. If unacceptable, switch to provisioned concurrency or
retroactively pivot to a container deploy.

**Done when** — PR-deployed Lambda passes smoke test
(`POST /api/forms/cm-02`); serves at `clubstraylight.com/cm02` with no URL
change.

### Phase 6 — Golden pipeline for Ruby (Track B)

`.github/workflows/golden-pipeline.yml` mirroring CM02's, with swaps:

| CM02 step | Ruby equivalent |
|---|---|
| gitleaks | gitleaks (unchanged) |
| `npm audit` | `bundle exec bundler-audit check --update` |
| Trivy fs | Trivy fs (unchanged) |
| `prettier --check` | `bundle exec rubocop` |
| `jest` | `bundle exec rspec` |
| anchore/sbom-action | anchore/sbom-action (detects Gemfile.lock) |
| `generate-oscal.js` | `bundle exec oscal-generate evidence/` (Phase 1) |
| `verify-evidence.js` | `bundle exec oscal-verify-evidence evidence/` (Phase 2) |

`ci-cd.yml` calls golden-pipeline, then `scripts/deploy.rb` on master.

**Deps added** — `bundler-audit` (dev).

**Done when** — all six jobs (secrets/test/vuln/sbom/oscal/verify) green on
a PR.

### Phase 7 — Attestation + SSDF gap (Track B, polish)

- `scripts/attest.rb` — Solana on-chain hash attestation. Recommend
  shelling out to a vendored Node helper (reuse `scripts/attest.mjs`)
  rather than adding `solana-ruby`. Keeps gemspec deps clean.
- `scripts/ssdf-gap-analysis.rb` — port of `ssdf-gap-analysis.sh`;
  leverage `lib/oscal/system_security_plan.rb` against
  `data/NIST_SP-218_SSDF_catalog.json` for automatic gap detection.

**Done when** — master deploys emit on-chain attestation and SSDF gap report.

### Phase 8 — Cutover + retire CM02

1. Deploy oscal Lambda to a staging URL; soak test for 48h.
2. Cut DNS / API Gateway custom domain `clubstraylight.com/cm02` over to
   the oscal Lambda.
3. Verify presigned URLs, rate limiting, audit log from new Lambda.
4. Archive CM02 repo. Add a `README.md` pointer to oscal. Keep for git
   history.
5. Update `form-terra` to remove the CM02 Lambda resource (or rename it
   `oscal-forms`).

---

## Dependency additions summary

```
# runtime
prawn, prawn-table         # PDF (Phase 3)
sinatra                    # web (Phase 4)
aws-sdk-s3                 # storage (Phase 4)
lamby                      # Lambda adapter (Phase 5)

# dev
bundler-audit              # CI vuln scan (Phase 6)
rack-test                  # web tests (Phase 4)
```

oscal goes from zero runtime deps to four. Worth it for what's absorbed,
but it changes the gem's character. If preserving the "pure stdlib gem"
identity for the library subset matters, split lib code into `oscal-core`
(no deps) + `oscal-web` (deps) within the same repo via a multi-gemspec
setup. Not recommended in v1; revisit post-cutover.

## Estimated effort

| Phase | Effort |
|---|---|
| 1 — Generators | 1 week |
| 2 — Evidence | 2-3 days |
| 3 — PDF (Prawn port + generalize) | 1.5 weeks |
| 4 — Web app | 1.5 weeks |
| 5 — Lambda + Terraform | 3-4 days |
| 6 — Golden pipeline | 3-4 days |
| 7 — Attestation + SSDF | 2-3 days |
| 8 — Cutover | 2-3 days |
| **Total** | **~6-7 weeks** |

## Open questions

1. **Versioning at cutover** — bump oscal from 0.1.0 → 1.0.0 when Phase 8
   completes? Recommended: yes.
2. **Gem split** — keep one fat gem or split `oscal-core` / `oscal-web`?
   Defer until post-cutover unless strong preference now.
3. **Other CM02 controls in flight?** — Phase 3's "generic any-control"
   choice already covers CM-03, AC-02, etc. Confirm scope.
4. **Cold-start ceiling** — what's the acceptable upper bound for
   p95 first-byte on `/forms/cm-02`? Determines whether Phase 5 needs
   provisioned concurrency.

## CM02 capabilities deliberately NOT carried over

None. Full absorption is the goal — every CM02 capability has a port
target above.
