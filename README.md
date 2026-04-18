# stamp-verify

Open-source CLI to independently verify [BA | Stamp](https://bastamp.com) blockchain timestamps.

No account needed. No dependency on bastamp.com. Just cryptographic math and a public blockchain.

## What it does

1. Computes the SHA-256 hash of your file (or accepts a known hash)
2. Rebuilds the Merkle root from the hash + proof (keccak256, sortPairs)
3. Queries the [Stamper smart contract](https://polygonscan.com/address/0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d#code) on Polygon
4. Reports the on-chain timestamp if the root is anchored

## Install

```bash
npm install -g stamp-verify
```

Or run without installing:

```bash
npx stamp-verify document.pdf --proof proof.json
```

## Usage

### Verify a file

```bash
stamp-verify document.pdf --proof proof.json
```

### Verify using a known hash

```bash
stamp-verify --hash 0x3a7bd3e2... --proof proof.json
```

### Just compute the SHA-256

```bash
stamp-verify hash document.pdf
```

### JSON output

```bash
stamp-verify document.pdf --proof proof.json --json
```

## Where to get the proof

The Merkle proof is included in every BA | Stamp certificate PDF (page 2). You can also download it from the public verification page:

```
https://bastamp.com/verify/<your-file-hash>
```

Save the proof array as a JSON file:

```json
["0xabc123...", "0xdef456...", "0x789..."]
```

## How it works

BA | Stamp batches document hashes into a Merkle tree and anchors the root on the Polygon blockchain. Each document gets a Merkle inclusion proof that links it to the on-chain root.

This tool reproduces the verification locally:

- **SHA-256** — same algorithm used by BA | Stamp in the browser
- **keccak256 + sortPairs** — same Merkle tree construction as the [Stamper contract](https://polygonscan.com/address/0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d#code)
- **On-chain query** — reads `timestamps(root)` from the public smart contract

The Stamper contract is verified on Polygonscan. Anyone can inspect the source code.

## Contract

| | |
|---|---|
| **Address** | `0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d` |
| **Chain** | Polygon (PoS) |
| **Verified source** | [Polygonscan](https://polygonscan.com/address/0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d#code) |

## Desktop app (GUI)

A Tauri-based desktop binary lives in [`gui/`](./gui). Same verification
logic as the CLI (via `src/core/verify.ts`), wrapped in a drag-a-file UI.

### Download

Pre-built binaries for each platform are published on the [releases page](https://github.com/stamp-verify/stamp-verify/releases/latest):

- **macOS (Apple Silicon)** — `.dmg`
- **Windows** — `.msi` installer or `.exe` setup
- **Linux** — `.AppImage`, `.deb`, or `.rpm`

> macOS: right-click → Open the first time (unsigned until Apple Developer enrollment).
> Windows: SmartScreen click-through unless signed via SignPath Foundation.

### Run in browser (dev)

From the repo root:

```bash
npm install       # installs CLI + GUI deps (npm workspaces)
npm run dev:gui   # opens http://localhost:1420
```

### Build the native binary

Requires Rust and, on Linux, Tauri's system dependencies:

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config

# macOS: Xcode Command Line Tools (xcode-select --install)
# Windows: Microsoft Visual Studio C++ Build Tools + WebView2 (pre-installed on Win 11)
```

Then, from the repo root:

```bash
npm run tauri:build --workspace gui   # produces .dmg / .msi / .AppImage under gui/src-tauri/target/release/bundle/
```

## License

MIT — use it however you want.
