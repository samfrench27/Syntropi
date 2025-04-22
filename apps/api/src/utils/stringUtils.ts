/**
 * Removes HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Cleans a string for use as a bank name
 * - Removes HTML tags
 * - Trims whitespace
 * - Replaces multiple spaces with a single space
 */
export function cleanBankName(name: string): string {
  if (!name) return '';
  
  return stripHtml(name)
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Transforms camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transforms snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
} 