/** Build an exact wire-size form, not a string of the requested character count. */
export function draftWithEncodedSize(bytes: number) {
  const title = 'Весна & лето';
  const empty = new URLSearchParams({ title, body: '' }).toString();
  const remaining = bytes - Buffer.byteLength(empty);
  if (!Number.isSafeInteger(remaining) || remaining <= 0) throw new RangeError('Size must allow a nonempty body');
  const content = { title, body: 'x'.repeat(remaining) };
  return { content, encoded: new URLSearchParams(content).toString() };
}
