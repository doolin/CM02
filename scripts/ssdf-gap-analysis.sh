#!/usr/bin/env bash
#
# SSDF Gap Analysis for CI/CD Pipeline
#
# Scans the GitHub Actions workflow(s) for the presence of controls
# required by NIST SP 800-218 (SSDF v1.1). Reports PASS/FAIL for
# each control and exits non-zero if any mandatory control is missing.
#
# Usage: ./scripts/ssdf-gap-analysis.sh [workflow-file]
#        Default: .github/workflows/ci-cd.yml

set -euo pipefail

WORKFLOW="${1:-.github/workflows/ci-cd.yml}"
GAPS=0
PASSES=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

check() {
  local control="$1"
  local name="$2"
  local pattern="$3"
  local showstopper="${4:-yes}"

  TOTAL=$((TOTAL + 1))

  if grep -qiE "$pattern" "$WORKFLOW" 2>/dev/null; then
    PASSES=$((PASSES + 1))
    printf "${GREEN}PASS${NC}  %-8s %s\n" "$control" "$name"
  else
    GAPS=$((GAPS + 1))
    if [ "$showstopper" = "yes" ]; then
      printf "${RED}FAIL${NC}  %-8s %s ${RED}(SHOWSTOPPER)${NC}\n" "$control" "$name"
    else
      printf "${YELLOW}WARN${NC}  %-8s %s\n" "$control" "$name"
    fi
  fi
}

echo ""
printf "${BOLD}SSDF Gap Analysis — NIST SP 800-218 v1.1${NC}\n"
printf "${BOLD}Workflow: ${NC}%s\n" "$WORKFLOW"
echo "─────────────────────────────────────────────────────────"

if [ ! -f "$WORKFLOW" ]; then
  printf "${RED}ERROR: Workflow file not found: %s${NC}\n" "$WORKFLOW"
  exit 2
fi

echo ""
printf "${BOLD}Artifact-Producing Controls${NC}\n"
echo ""

# PO.5: Secure build environment — actions pinned to SHA
check "PO.5" "Secure build environment (SHA-pinned actions)" \
  "uses:.*@[0-9a-f]{40}" "yes"

# PW.4: SBOM generation
check "PW.4" "SBOM generation" \
  "sbom-action|sbom|cyclonedx|spdx|syft|cdxgen" "yes"

# PW.6: Secrets scanning
check "PW.6" "Secrets scanning" \
  "gitleaks|trufflehog|detect-secrets|secret.scan" "yes"

# PW.7: Dependency vulnerability scanning
check "PW.7" "Dependency vulnerability scanning" \
  "npm audit|yarn audit|snyk|dependabot|audit-level" "yes"

# PW.8: Executable/filesystem vulnerability scanning
check "PW.8" "Vulnerability scanning (SAST/DAST/filesystem)" \
  "trivy|grype|snyk test|codeql|semgrep|sonar" "yes"

# PS.1/PS.2: Provenance and integrity
check "PS.1" "Build provenance / artifact signing" \
  "attest-build-provenance|cosign|sigstore|slsa-provenance|provenance" "yes"

echo ""
printf "${BOLD}Process Controls (verified by presence in workflow)${NC}\n"
echo ""

# PO.4: Security checks as gate
check "PO.4" "Security jobs gate deployment" \
  "needs:.*\\[.*(secrets-scan|vulnerability-scan|sbom)" "yes"

# PW.5: Secure coding practices (linting/formatting)
check "PW.5" "Code formatting / linting enforcement" \
  "prettier|eslint|format:check|lint" "no"

# RV.1: Continuous scanning (CI runs on push)
check "RV.1" "CI runs on every push (continuous scanning)" \
  "on:.*push|push:" "no"

# RV.2: Severity-gated scanning
check "RV.2" "Severity-gated scanning (CRITICAL/HIGH)" \
  "severity.*CRITICAL|audit-level.*high|CRITICAL.*HIGH" "no"

echo ""
echo "─────────────────────────────────────────────────────────"
printf "${BOLD}Results: ${NC}%d/%d passed, %d gaps\n" "$PASSES" "$TOTAL" "$GAPS"

if [ "$GAPS" -gt 0 ]; then
  echo ""
  printf "${RED}${BOLD}SSDF gap analysis found %d control gap(s).${NC}\n" "$GAPS"
  printf "Review NIST SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final\n"
  exit 1
else
  echo ""
  printf "${GREEN}${BOLD}All SSDF controls are present in the pipeline.${NC}\n"
  exit 0
fi
