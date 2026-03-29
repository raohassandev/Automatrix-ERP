import validator from 'validator';

const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function sanitizeString(input: string): string {
  return validator.trim(input).replace(CONTROL_CHAR_PATTERN, "");
}

export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return "";

  let decoded = input;
  for (let i = 0; i < 3; i += 1) {
    const next = validator.unescape(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}
