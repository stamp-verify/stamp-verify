/**
 * Pure verification logic — runs in Node, browser, and Tauri webview.
 *
 * Zero Node-specific dependencies. File I/O lives in ../node.ts (CLI) and the
 * GUI passes bytes from File.arrayBuffer() / drag-drop.
 */

import { createPublicClient, http, keccak256, sha256, type Hex } from "viem";
import { polygon } from "viem/chains";

const STAMPER_ABI = [
  {
    inputs: [{ name: "root", type: "bytes32" }],
    name: "timestamps",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const STAMPER_ADDRESS = "0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d" as const;
export const DEFAULT_RPC = "https://polygon-bor-rpc.publicnode.com";

export interface VerifyResult {
  fileHash: Hex;
  merkleRoot: Hex;
  onChainTimestamp: number;
  blockTime: Date;
  verified: boolean;
  chain: string;
  contract: string;
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.slice(2);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): Hex {
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out as Hex;
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** SHA-256 of arbitrary bytes. */
export function hashBytes(data: Uint8Array): Hex {
  return sha256(data);
}

/**
 * Rebuild the Merkle root from a leaf and its proof.
 * keccak256 with sortPairs — identical to BA | Stamp's anchor.
 */
export function rebuildMerkleRoot(leafHash: Hex, proof: Hex[]): Hex {
  let current = hexToBytes(leafHash);
  for (const p of proof) {
    const sibling = hexToBytes(p);
    const leftFirst = compareBytes(current, sibling) <= 0;
    const pair = new Uint8Array(current.length + sibling.length);
    if (leftFirst) {
      pair.set(current, 0);
      pair.set(sibling, current.length);
    } else {
      pair.set(sibling, 0);
      pair.set(current, sibling.length);
    }
    current = hexToBytes(keccak256(pair));
  }
  return bytesToHex(current);
}

/** Verify a known SHA-256 hash against the Stamper contract. */
export async function verifyHash(
  contentHash: Hex,
  proof: Hex[],
  rpcUrl: string = DEFAULT_RPC,
): Promise<VerifyResult> {
  const merkleRoot = rebuildMerkleRoot(contentHash, proof);

  const client = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl),
  });

  const timestamp = await client.readContract({
    address: STAMPER_ADDRESS,
    abi: STAMPER_ABI,
    functionName: "timestamps",
    args: [merkleRoot],
  });

  return {
    fileHash: contentHash,
    merkleRoot,
    onChainTimestamp: Number(timestamp),
    blockTime: new Date(Number(timestamp) * 1000),
    verified: Number(timestamp) > 0,
    chain: "Polygon",
    contract: STAMPER_ADDRESS,
  };
}

/** Verify raw bytes (file contents) against the Stamper contract. */
export async function verifyBytes(
  data: Uint8Array,
  proof: Hex[],
  rpcUrl?: string,
): Promise<VerifyResult> {
  return verifyHash(hashBytes(data), proof, rpcUrl);
}
