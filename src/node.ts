/**
 * Node-only helpers: wrap the pure core with fs-based file reading.
 * The CLI uses these; the GUI uses core/verify.ts directly.
 */

import { readFileSync } from "node:fs";
import type { Hex } from "viem";
import {
  hashBytes,
  verifyBytes,
  verifyHash,
  type VerifyResult,
} from "./core/verify.js";

export function hashFile(filePath: string): Hex {
  const data = readFileSync(filePath);
  return hashBytes(new Uint8Array(data));
}

export async function verifyTimestamp(
  filePath: string,
  proof: Hex[],
  rpcUrl?: string,
): Promise<VerifyResult> {
  const data = readFileSync(filePath);
  return verifyBytes(new Uint8Array(data), proof, rpcUrl);
}

export { verifyHash };
export type { VerifyResult };
