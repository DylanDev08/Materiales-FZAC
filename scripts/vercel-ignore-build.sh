#!/usr/bin/env bash
set -u

CANONICAL_PROJECT_ID="prj_EqB7dnnuor0xae0rqgozLIsucFzd"
PROJECT_ID="${VERCEL_PROJECT_ID:-}"
GIT_REF="${VERCEL_GIT_COMMIT_REF:-}"

# Exit 0 tells Vercel to skip a build. Exit 1 tells it to continue.
# If Vercel does not expose the project ID for any reason, fail open and build.
if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "$CANONICAL_PROJECT_ID" ]]; then
  echo "Skipping Vercel build for non-canonical project."
  exit 0
fi

# Dependency PRs are already validated by GitHub Actions and do not need a Vercel preview.
if [[ "$GIT_REF" == dependabot/* ]]; then
  echo "Skipping Vercel preview for Dependabot branch."
  exit 0
fi

exit 1
