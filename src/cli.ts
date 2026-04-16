#!/usr/bin/env node

import { existsSync } from "node:fs";
import { hashFile, verifyTimestamp, verifyHash } from "./node.js";
import type { Hex } from "viem";

const HELP = `
stamp-verify — Independently verify BA | Stamp blockchain timestamps

USAGE
  stamp-verify <file> --proof <proof.json>     Verify a file against its Merkle proof
  stamp-verify --hash <sha256> --proof <proof>  Verify using a known hash
  stamp-verify hash <file>                      Just compute SHA-256 of a file

OPTIONS
  --proof <path>    Path to JSON file containing the Merkle proof (array of hex strings)
  --hash <hex>      SHA-256 hash (0x-prefixed) instead of a file
  --rpc <url>       Custom Polygon RPC URL (default: public RPC)
  --json            Output as JSON
  --help            Show this help

EXAMPLES
  stamp-verify document.pdf --proof proof.json
  stamp-verify hash document.pdf
  stamp-verify --hash 0xabc123... --proof proof.json

WHAT IT DOES
  1. Computes SHA-256 of your file (or uses the provided hash)
  2. Rebuilds the Merkle root from the hash + proof (keccak256, sortPairs)
  3. Queries the Stamper contract on Polygon to check if the root is anchored
  4. Reports the on-chain timestamp if found

  The verification is fully independent — it queries a public blockchain
  and uses open cryptographic primitives. No dependency on bastamp.com.

CONTRACT
  Stamper: 0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d (Polygon)
  Verified source: https://polygonscan.com/address/0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d#code
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  // Hash-only mode
  if (args[0] === "hash") {
    const filePath = args[1];
    if (!filePath || !existsSync(filePath)) {
      console.error("Error: file not found:", filePath);
      process.exit(1);
    }
    const hash = hashFile(filePath);
    console.log(hash);
    process.exit(0);
  }

  // Parse flags
  const jsonOutput = args.includes("--json");
  const proofIdx = args.indexOf("--proof");
  const hashIdx = args.indexOf("--hash");
  const rpcIdx = args.indexOf("--rpc");

  const proofPath = proofIdx >= 0 ? args[proofIdx + 1] : null;
  const hashValue = hashIdx >= 0 ? args[hashIdx + 1] : null;
  const rpcUrl = rpcIdx >= 0 ? args[rpcIdx + 1] : undefined;

  // File path is the first non-flag argument
  const filePath = args.find((a, i) => !a.startsWith("--") && (i === 0 || !["--proof", "--hash", "--rpc"].includes(args[i - 1])));

  if (!proofPath) {
    console.error("Error: --proof <path> is required. Pass the Merkle proof JSON file.");
    console.error("You can download the proof from the certificate PDF or the verify page on bastamp.com.");
    process.exit(1);
  }

  if (!existsSync(proofPath)) {
    console.error("Error: proof file not found:", proofPath);
    process.exit(1);
  }

  // Load proof
  const { readFileSync } = await import("node:fs");
  let proof: Hex[];
  try {
    const raw = JSON.parse(readFileSync(proofPath, "utf8"));
    proof = Array.isArray(raw) ? raw : raw.proof || raw.merkleProof;
    if (!Array.isArray(proof)) throw new Error("Expected an array of hex strings");
  } catch (e: unknown) {
    console.error("Error: invalid proof file.", (e as Error).message);
    process.exit(1);
  }

  try {
    let result;
    if (hashValue) {
      result = await verifyHash(hashValue as Hex, proof, rpcUrl);
    } else if (filePath && existsSync(filePath)) {
      if (!jsonOutput) console.log(`Hashing ${filePath}...`);
      result = await verifyTimestamp(filePath, proof, rpcUrl);
    } else {
      console.error("Error: provide a file path or --hash <sha256>");
      process.exit(1);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("");
      console.log(result.verified ? "✓ VERIFIED" : "✗ NOT VERIFIED");
      console.log("");
      console.log(`  File hash:    ${result.fileHash}`);
      console.log(`  Merkle root:  ${result.merkleRoot}`);
      console.log(`  Chain:        ${result.chain}`);
      console.log(`  Contract:     ${result.contract}`);
      if (result.verified) {
        console.log(`  Timestamp:    ${result.blockTime.toISOString()}`);
        console.log(`  Unix:         ${result.onChainTimestamp}`);
      } else {
        console.log(`  Status:       No matching root found on-chain`);
      }
      console.log("");
    }

    process.exit(result.verified ? 0 : 1);
  } catch (e: unknown) {
    console.error("Error:", (e as Error).message);
    process.exit(1);
  }
}

main();
