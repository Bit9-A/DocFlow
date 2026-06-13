// ============================================================
// Secure variable interpolation engine
// Resolves {{path.to.value}} against a data payload.
//
// Security invariants:
//  1. Prototype pollution blocked (constructor, __proto__, prototype)
//  2. Path depth limited to MAX_PATH_DEPTH
//  3. Only own-property access via hasOwnProperty
//  4. All output coerced to string — no code execution
// ============================================================

const MAX_PATH_DEPTH = 10;

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

const INTERPOLATION_REGEX = /\{\{(.*?)\}\}/g;

/**
 * Resolves a dot-notation path against an object.
 * Returns empty string for any invalid/missing access.
 */
export function resolvePayload(
  path: string,
  obj: Record<string, unknown>,
): string {
  const segments = path.trim().split('.');

  if (segments.length > MAX_PATH_DEPTH) {
    return '';
  }

  let current: unknown = obj;

  for (const segment of segments) {
    const key = segment.trim();

    if (key === '' || FORBIDDEN_KEYS.has(key)) {
      return '';
    }

    if (current === null || current === undefined) {
      return '';
    }

    if (typeof current !== 'object' || Array.isArray(current)) {
      return '';
    }

    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return '';
    }

    current = (current as Record<string, unknown>)[key];
  }

  if (current === null || current === undefined) {
    return '';
  }

  return String(current);
}

/**
 * Replaces all {{variable}} occurrences in a template string
 * using values from the provided data object.
 *
 * @example
 * interpolate('Hello, {{user.name}}!', { user: { name: 'Ada' } })
 * // => 'Hello, Ada!'
 */
export function interpolate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(INTERPOLATION_REGEX, (_, match: string) => {
    return resolvePayload(match, data);
  });
}

/**
 * HTML-safe version of interpolate.
 * Escapes output to prevent XSS when embedding in HTML contexts.
 */
export function interpolateHtml(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(INTERPOLATION_REGEX, (_, match: string) => {
    return escapeHtml(resolvePayload(match, data));
  });
}

/**
 * Escapes a string for safe inclusion in HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extracts all variable paths referenced in a template string.
 * Useful for validation (e.g., checking data completeness before render).
 *
 * @example
 * extractVariables('Hello {{user.name}}, order {{order.id}}')
 * // => ['user.name', 'order.id']
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  const regex = new RegExp(INTERPOLATION_REGEX.source, 'g');
  while ((match = regex.exec(template)) !== null) {
    const path = match[1]?.trim();
    if (path !== undefined && path !== '') {
      matches.push(path);
    }
  }

  return [...new Set(matches)]; // deduplicate
}
