export function parseMultipartAudio(
  body: Buffer,
  contentType: string
): { buffer: Buffer; mimeType: string; language?: string } {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error('Invalid multipart upload');

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(boundaryBuffer);
  let audio: { buffer: Buffer; mimeType: string } | null = null;
  let language: string | undefined;

  while (cursor !== -1) {
    cursor += boundaryBuffer.length;
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd === -1) break;

    const headers = body.subarray(cursor, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(boundaryBuffer, dataStart);
    const dataEnd = nextBoundary === -1 ? body.length : Math.max(dataStart, nextBoundary - 2);
    const part = body.subarray(dataStart, dataEnd);

    if (/name="audio"/.test(headers)) {
      const mimeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
      audio = {
        buffer: part,
        mimeType: mimeMatch?.[1]?.split(';')[0].trim() ?? 'audio/wav',
      };
    } else if (/name="language"/.test(headers)) {
      const value = part.toString('utf8').trim();
      if (value) language = value;
    }

    cursor = nextBoundary;
  }

  if (!audio?.buffer.length) throw new Error('Missing audio recording');
  return { ...audio, language };
}
