import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MerkleTree } from "merkletreejs";
import { createPublicClient, http, keccak256, type Hex } from "viem";
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

const STAMPER_ADDRESS = "0x50ddee9a1afbe1a14f1cf01b379535f897b3ca3d" as const;
const DEFAULT_RPC = "https://polygon-bor-rpc.publicnode.com";

export interface VerifyResult {
  fileHash: Hex;
  merkleRoot: Hex;
  onChainTimestamp: number;
  blockTime: Date;
  verified: boolean;
  chain: string;
  contract: string;
}

/**
 * Hash a file using SHA-256 (same as BA | Stamp client-side hashing)
 */
export function hashFile(filePath: string): Hex {
  const data = readFileSync(filePath);
  const hash = createHash("sha256").update(data).digest("hex");
  return `0x${hash}`;
}

/**
 * Rebuild the Merkle root from a leaf and its proof.
 * Uses keccak256 with sortPairs — identical to BA | Stamp's implementation.
 */
export function rebuildMerkleRoot(leafHash: Hex, proof: Hex[]): Hex {
  const leaf = Buffer.from(leafHash.slice(2), "hex");
  const proofBuffers = proof.map((p) => ({
    position: "left" as const, // MerkleTree.verify handles sorting via sortPairs
    data: Buffer.from(p.slice(2), "hex"),
  }));

  const tree = new MerkleTree([], (data: Buffer) => Buffer.from(keccak256(data).slice(2), "hex"), {
    sortPairs: true,
  });

  const verified = tree.verify(proofBuffers, leaf, Buffer.alloc(0));
  if (!verified) {
    // Manually reconstruct to get the root
    let current = leaf;
    for (const p of proof) {
      const sibling = Buffer.from(p.slice(2), "hex");
      const pair = Buffer.compare(current, sibling) <= 0
        ? Buffer.concat([current, sibling])
        : Buffer.concat([sibling, current]);
      current = Buffer.from(keccak256(pair as unknown as Uint8Array).slice(2), "hex");
    }
    return `0x${current.toString("hex")}`;
  }

  // MerkleTree.verify returned true but we still need the root
  let current = leaf;
  for (const p of proof) {
    const sibling = Buffer.from(p.slice(2), "hex");
    const pair = Buffer.compare(current, sibling) <= 0
      ? Buffer.concat([current, sibling])
      : Buffer.concat([sibling, current]);
    current = Buffer.from(keccak256(pair as unknown as Uint8Array).slice(2), "hex");
  }
  return `0x${current.toString("hex")}`;
}

/**
 * Verify a file's timestamp on-chain.
 *
 * @param filePath - Path to the file to verify
 * @param proof - Merkle proof (array of 0x-prefixed hex strings)
 * @param rpcUrl - Polygon RPC URL (optional, defaults to public RPC)
 */
export async function verifyTimestamp(
  filePath: string,
  proof: Hex[],
  rpcUrl: string = DEFAULT_RPC,
): Promise<VerifyResult> {
  const fileHash = hashFile(filePath);
  const merkleRoot = rebuildMerkleRoot(fileHash, proof);

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
    fileHash,
    merkleRoot,
    onChainTimestamp: Number(timestamp),
    blockTime: new Date(Number(timestamp) * 1000),
    verified: Number(timestamp) > 0,
    chain: "Polygon",
    contract: STAMPER_ADDRESS,
  };
}

/**
 * Verify using only a hash (no file needed) — useful when you already have the SHA-256.
 */
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
