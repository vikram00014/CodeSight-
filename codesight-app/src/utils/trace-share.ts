import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import {
  CompressedTrace,
  ExecutionSnapshot,
  TraceMetadata,
} from "@/src/types/execution";

export interface ShareableTraceBundle {
  snapshots: ReadonlyArray<ExecutionSnapshot>;
  compressedTrace: CompressedTrace;
  metadata: TraceMetadata;
}

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

export function exportTraceJson(bundle: ShareableTraceBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export async function exportTraceGzip(bundle: ShareableTraceBundle): Promise<Uint8Array> {
  const text = exportTraceJson(bundle);
  return gzipCompress(text);
}

export function importTraceJson(text: string): ShareableTraceBundle {
  return JSON.parse(text) as ShareableTraceBundle;
}

export async function importTraceData(
  input: string | ArrayBuffer | Uint8Array,
): Promise<ShareableTraceBundle> {
  if (typeof input === "string") {
    return importTraceJson(input);
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  const text = isGzipPayload(bytes)
    ? await gunzipToText(bytes)
    : new TextDecoder().decode(bytes);

  return importTraceJson(text);
}

export function encodeTraceToUrl(bundle: ShareableTraceBundle): string {
  return compressToEncodedURIComponent(JSON.stringify(bundle));
}

export function decodeTraceFromUrl(token: string): ShareableTraceBundle | undefined {
  const raw = decompressFromEncodedURIComponent(token);
  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw) as ShareableTraceBundle;
}

function isGzipPayload(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
}

async function gzipCompress(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    return new TextEncoder().encode(text);
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode(text));
  await writer.close();

  const compressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function gunzipToText(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Gzip import is not supported in this browser runtime.");
  }

  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const safeBytes = new Uint8Array(bytes);
  await writer.write(safeBytes);
  await writer.close();

  const decompressed = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}
