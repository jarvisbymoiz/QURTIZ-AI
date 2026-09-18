/** Header checks reject spoofed MIME types before an object becomes content. */
export function matchesMediaHeader(bytes: Uint8Array, mime: string): boolean {
  const b = Buffer.from(bytes);
  if (mime === "image/png") return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === "image/jpeg") return b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === "image/webp") return b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP";
  if (mime === "video/webm") return b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
  if (mime === "video/mp4" || mime === "video/quicktime") return b.length >= 12 && b.toString("ascii",4,8) === "ftyp";
  return false;
}
