# Code signing

The release workflow supports optional code signing via
[SignPath Foundation](https://signpath.io/foundation) — a free code-signing
service for legitimate open-source projects. Until applied for and approved,
Windows installers ship unsigned; Linux doesn't need signing; macOS requires
an Apple Developer account (see below).

## Windows — SignPath Foundation (free)

### 1. Apply

Go to <https://signpath.io/foundation> and submit a new project. The form
asks for a few details — pre-filled values for this repo:

| Field | Value |
| --- | --- |
| Project name | `stamp-verify` |
| Project URL | `https://github.com/stamp-verify/stamp-verify` |
| License | MIT |
| Repository type | Public GitHub |
| Build system | GitHub Actions |
| Binary type | Native desktop app (Tauri, Rust + WebView2) |
| Purpose | Independently verifies BA \| Stamp blockchain timestamps |

Approval typically takes 3–10 business days. Foundation accounts get the
same Microsoft Trusted Signing certificate used by paid accounts — once
signed, SmartScreen "unknown publisher" warnings disappear.

### 2. Add secrets

After approval SignPath provides 4 identifiers. Add them as
**repository secrets** in GitHub (Settings → Secrets and variables →
Actions → New repository secret):

- `SIGNPATH_API_TOKEN`
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG` (usually `stamp-verify`)
- `SIGNPATH_SIGNING_POLICY_SLUG` (usually `release-signing`)

### 3. Next release

The next `v*.*.*` tag will automatically route the Windows installer
through SignPath before uploading to the GitHub Release. No further code
changes needed — `release.yml` already has the conditional step.

## macOS — Apple Developer ($99/year)

Unsigned `.dmg` / `.app` bundles trigger Gatekeeper's "unidentified
developer" warning. The workaround (right-click → Open) is fine for
technical users but poor UX for everyone else.

When ready:

1. Enroll at <https://developer.apple.com/programs/> ($99/year individual).
2. Generate a Developer ID Application certificate in Keychain Access.
3. Export as `.p12` with a password.
4. Add these secrets:
   - `APPLE_CERTIFICATE` (base64 of the `.p12`)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY` (e.g. `Developer ID Application: Your Name (TEAMID)`)
   - `APPLE_ID` (Apple ID email)
   - `APPLE_TEAM_ID`
   - `APPLE_PASSWORD` (app-specific password from appleid.apple.com)

The `tauri-action` already reads these env vars, so signing + notarization
activate automatically once present.

## Linux

No signing needed. `.AppImage` / `.deb` run on any mainstream distro.
