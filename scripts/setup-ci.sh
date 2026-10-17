#!/usr/bin/env bash
# One-time setup for continuous deployment from GitHub Actions to Firebase.
#
#   scripts/setup-ci.sh <firebase-project-id> [owner/repo]
#
# Creates a least-privilege deploy service account, then stores two repository secrets:
#   FIREBASE_SERVICE_ACCOUNT  JSON key the workflows deploy with
#   FIREBASE_WEB_CONFIG       the web app's public config, injected at build time
#
# Requires gcloud (signed in as a project owner), gh (signed in with access to the repo) and node.
# The project needs a Firebase web app, Firestore and the sign-in providers (docs/RELEASING.md).
#
# Safe to re-run: an existing FIREBASE_SERVICE_ACCOUNT secret is kept unless ROTATE_KEY=1.
# With several web apps in the project, choose one with WEB_APP_ID=<app id>.
set -euo pipefail

PROJECT_ID="${1:?Usage: scripts/setup-ci.sh <firebase-project-id> [owner/repo]}"
REPO="${2:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
SA_NAME="github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
FIREBASE_API="https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}"
ROLES=(
  roles/firebasehosting.admin            # deploy hosting and preview channels
  roles/firebaserules.admin              # deploy firestore.rules
  roles/datastore.indexAdmin             # deploy firestore.indexes.json
  roles/serviceusage.serviceUsageConsumer
  roles/serviceusage.apiKeysViewer       # used by the Firebase CLI during deploy
)

fail() {
  echo "✗ $*" >&2
  exit 1
}

# Calls the Firebase Management API with the signed-in gcloud account.
firebase_api() {
  curl --silent --show-error --fail-with-body \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "X-Goog-User-Project: ${PROJECT_ID}" \
    "${FIREBASE_API}$1"
}

echo "› Project ${PROJECT_ID}, repository ${REPO}"

# --- Deploy service account -------------------------------------------------------------------

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "› Creating service account ${SA_EMAIL}"
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" \
    --display-name "GitHub Actions deploy"
fi

for role in "${ROLES[@]}"; do
  echo "› Granting ${role}"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${SA_EMAIL}" \
    --role "$role" --condition None --quiet >/dev/null
done

if gh secret list --repo "$REPO" --json name --jq '.[].name' | grep -qx FIREBASE_SERVICE_ACCOUNT \
  && [ "${ROTATE_KEY:-}" != 1 ]; then
  echo "› FIREBASE_SERVICE_ACCOUNT already set; keeping it (ROTATE_KEY=1 to replace)"
else
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  echo "› Creating a key and saving it as FIREBASE_SERVICE_ACCOUNT"
  gcloud iam service-accounts keys create "$KEY_FILE" --iam-account "$SA_EMAIL" --project "$PROJECT_ID"
  gh secret set FIREBASE_SERVICE_ACCOUNT --repo "$REPO" < "$KEY_FILE"
fi

# --- Web app config ---------------------------------------------------------------------------

echo "› Reading the web app config"
if [ -z "${WEB_APP_ID:-}" ]; then
  APPS_JSON="$(firebase_api /webApps)" || fail "Could not list web apps: ${APPS_JSON:-}"
  WEB_APP_ID="$(node -e '
    const apps = (JSON.parse(process.argv[1]).apps ?? []).filter((a) => a.state !== "DELETED");
    if (apps.length === 0) process.exit(2);
    if (apps.length > 1) console.error(`  ${apps.length} web apps found, using "${apps[0].displayName ?? apps[0].appId}". Set WEB_APP_ID to choose.`);
    console.log(apps[0].appId);
  ' "$APPS_JSON")" || fail "No web app in ${PROJECT_ID}. Add one: Firebase console → Project settings → Your apps → Web."
fi

CONFIG_RAW="$(firebase_api "/webApps/${WEB_APP_ID}/config")" \
  || fail "Could not read the config of web app ${WEB_APP_ID}: ${CONFIG_RAW:-}"

# Keep only the fields the app uses, and refuse to save anything incomplete.
WEB_CONFIG="$(node -e '
  const raw = JSON.parse(process.argv[1]);
  const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"];
  const config = Object.fromEntries(keys.filter((k) => raw[k]).map((k) => [k, raw[k]]));
  const missing = ["apiKey", "authDomain", "projectId", "appId"].filter((k) => !config[k]);
  if (missing.length) { console.error(`  missing ${missing.join(", ")}`); process.exit(1); }
  process.stdout.write(JSON.stringify(config));
' "$CONFIG_RAW")" || fail "The web app config is incomplete."

echo "› Saving it as FIREBASE_WEB_CONFIG"
gh secret set FIREBASE_WEB_CONFIG --repo "$REPO" --body "$WEB_CONFIG"

echo "✓ Done. Pushing to main now deploys to https://${PROJECT_ID}.web.app"
