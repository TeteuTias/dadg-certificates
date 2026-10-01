export function templateFormat(bytes: Uint8Array) {
  if (bytes.length < 8 || bytes.length > 10 * 1024 * 1024)
    throw new Error("Arquivo deve ter até 10 MB.");
  if (Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-")
    return { extension: "pdf", mime: "application/pdf" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { extension: "jpg", mime: "image/jpeg" };
  if (
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return { extension: "png", mime: "image/png" };
  throw new Error("Envie um arquivo PDF, PNG ou JPEG válido.");
}
