import validator from 'validator';

export function sanitizeString(input: string): string {
  // Trim whitespace from the beginning and end of the string
  let sanitized = validator.trim(input);

  // Escape HTML entities to prevent XSS attacks
  sanitized = validator.escape(sanitized);

  // You might want to add more sanitization rules here,
  // depending on the specific use case, e.g., removing specific characters,
  // normalizing unicode, etc.

  return sanitized;
}
