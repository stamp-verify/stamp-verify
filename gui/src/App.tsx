import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import type { Hex } from "viem";
import { hashBytes, verifyHash, type VerifyResult } from "@core/verify";

type Status =
  | { kind: "idle" }
  | { kind: "hashing"; fileName: string }
  | { kind: "verifying" }
  | { kind: "ok"; result: VerifyResult; fileName: string | null }
  | { kind: "err"; message: string };

const BA_COLOR = "#0cf57e";
const POLYGONSCAN = "https://polygonscan.com";

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [proofText, setProofText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function parseProof(text: string): Hex[] {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Paste the Merkle proof JSON");
    const raw: unknown = JSON.parse(trimmed);
    const arr =
      Array.isArray(raw)
        ? raw
        : typeof raw === "object" && raw !== null && Array.isArray((raw as Record<string, unknown>).proof)
          ? (raw as Record<string, unknown>).proof
          : typeof raw === "object" && raw !== null && Array.isArray((raw as Record<string, unknown>).merkleProof)
            ? (raw as Record<string, unknown>).merkleProof
            : null;
    if (!Array.isArray(arr)) throw new Error("Expected an array of hex strings");
    return arr as Hex[];
  }

  async function loadFile(file: File) {
    setStatus({ kind: "hashing", fileName: file.name });
    setFileName(file.name);
    const buf = new Uint8Array(await file.arrayBuffer());
    setFileBytes(buf);
    setStatus({ kind: "idle" });
  }

  async function handleVerify() {
    try {
      if (!fileBytes) {
        setStatus({ kind: "err", message: "Drop or pick a file first" });
        return;
      }
      const proof = parseProof(proofText);
      setStatus({ kind: "verifying" });
      const hash = hashBytes(fileBytes);
      const result = await verifyHash(hash, proof);
      setStatus({ kind: "ok", result, fileName });
    } catch (e) {
      setStatus({ kind: "err", message: (e as Error).message });
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await loadFile(file);
  }
  async function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
  }

  return (
    <div className="shell">
      <header className="hdr">
        <div className="logo">
          <span style={{ color: BA_COLOR }}>BA</span>
          <span className="dim">|</span>
          <span>STAMP</span>
        </div>
        <div className="tag">verifier — open source, no account, no tracking</div>
      </header>

      <main className="main">
        <section
          className={`drop ${dragOver ? "drop--over" : ""} ${fileBytes ? "drop--loaded" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={onFilePick}
          />
          {fileBytes ? (
            <>
              <div className="drop__icon">✓</div>
              <div className="drop__name">{fileName}</div>
              <div className="drop__size">{formatBytes(fileBytes.length)} — click to change</div>
            </>
          ) : (
            <>
              <div className="drop__icon">⇪</div>
              <div>Drop a file here, or click to pick</div>
              <div className="drop__hint">the file never leaves your device</div>
            </>
          )}
        </section>

        <label className="field">
          <span className="field__label">Merkle proof (paste JSON)</span>
          <textarea
            className="field__input"
            rows={6}
            placeholder='["0x...", "0x..."]  or  { "proof": ["0x...", "0x..."] }'
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            spellCheck={false}
          />
        </label>

        <button
          className="btn"
          onClick={handleVerify}
          disabled={status.kind === "hashing" || status.kind === "verifying"}
        >
          {status.kind === "hashing"
            ? "Reading file…"
            : status.kind === "verifying"
              ? "Querying Polygon…"
              : "Verify"}
        </button>

        {status.kind === "err" && <div className="result result--err">⚠  {status.message}</div>}

        {status.kind === "ok" && (
          <div className={`result ${status.result.verified ? "result--ok" : "result--err"}`}>
            <div className="result__headline">
              {status.result.verified ? "✓ Verified" : "✗ Not anchored"}
            </div>
            {status.result.verified && (
              <div className="result__when">
                Anchored on <b>{status.result.blockTime.toISOString()}</b>
              </div>
            )}
            <dl className="kv">
              <dt>File hash</dt>
              <dd>{status.result.fileHash}</dd>
              <dt>Merkle root</dt>
              <dd>{status.result.merkleRoot}</dd>
              <dt>Contract</dt>
              <dd>
                <a
                  href={`${POLYGONSCAN}/address/${status.result.contract}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {status.result.contract}
                </a>
              </dd>
              <dt>Chain</dt>
              <dd>{status.result.chain}</dd>
            </dl>
          </div>
        )}
      </main>

      <footer className="foot">
        <span>MIT licensed —</span>
        <a href="https://github.com/stamp-verify/stamp-verify" target="_blank" rel="noreferrer">source</a>
        <span>—</span>
        <a href="https://bastamp.com" target="_blank" rel="noreferrer">bastamp.com</a>
      </footer>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
