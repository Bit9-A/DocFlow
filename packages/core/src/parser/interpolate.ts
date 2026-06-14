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
 * Splits comma-separated function arguments safely, respecting nested parentheses
 * and string/number literals.
 */
function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      }
      current += char;
    } else if (char === "'" || char === '"') {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ',' && parenDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

/**
 * Secures and executes a supported function name with evaluated arguments.
 */
function executeFunction(
  name: string,
  args: unknown[],
): unknown {
  switch (name) {
    case 'SUM': {
      const array = args[0];
      const key = String(args[1] ?? '');
      if (!Array.isArray(array)) return 0;
      return array.reduce((acc: number, item: unknown) => {
        if (item && typeof item === 'object') {
          const val = Number((item as Record<string, unknown>)[key] ?? 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);
    }
    case 'AVG': {
      const array = args[0];
      const key = String(args[1] ?? '');
      if (!Array.isArray(array) || array.length === 0) return 0;
      const sum = array.reduce((acc: number, item: unknown) => {
        if (item && typeof item === 'object') {
          const val = Number((item as Record<string, unknown>)[key] ?? 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);
      return sum / array.length;
    }
    case 'COUNT': {
      const array = args[0];
      if (!Array.isArray(array)) return 0;
      return array.length;
    }
    case 'ADD': {
      const x = Number(args[0] ?? 0);
      const y = Number(args[1] ?? 0);
      return x + y;
    }
    case 'SUB':
    case 'SUBTRACT': {
      const x = Number(args[0] ?? 0);
      const y = Number(args[1] ?? 0);
      return x - y;
    }
    case 'MUL':
    case 'MULTIPLY': {
      const x = Number(args[0] ?? 0);
      const y = Number(args[1] ?? 0);
      return x * y;
    }
    case 'DIV':
    case 'DIVIDE': {
      const x = Number(args[0] ?? 0);
      const y = Number(args[1] ?? 1);
      return y === 0 ? 0 : x / y;
    }
    case 'ROUND': {
      const val = Number(args[0] ?? 0);
      const decimals = Number(args[1] ?? 0);
      const factor = Math.pow(10, decimals);
      return Math.round(val * factor) / factor;
    }
    case 'FORMAT_CURRENCY': {
      const val = Number(args[0] ?? 0);
      const symbol = String(args[1] ?? '$');
      if (isNaN(val)) return symbol + '0.00';
      return symbol + val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    default:
      return '';
  }
}

/**
 * Parses and evaluates an expression recursively.
 */
export function evaluateExpression(
  expr: string,
  data: Record<string, unknown>,
): unknown {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  // 1. String literals
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // 2. Number literals
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // 3. Function call: NAME(...)
  const fnMatch = trimmed.match(/^([A-Z_]+)\((.*)\)$/s);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const argsStr = fnMatch[2];
    const rawArgs = splitArguments(argsStr ?? '');
    const evaluatedArgs = rawArgs.map(arg => evaluateExpression(arg, data));
    return executeFunction(fnName ?? '', evaluatedArgs);
  }

  // 4. Otherwise variable path
  return resolvePayload(trimmed, data);
}

/**
 * Resolves a dot-notation path against an object.
 * Returns the raw resolved value (preserves arrays and other types)
 * or empty string for any invalid/missing access.
 * Callers that need a string must coerce explicitly.
 */
export function resolvePayload(
  path: string,
  obj: Record<string, unknown>,
): unknown {
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

    if (typeof current !== 'object') {
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

  return current;
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
    const resolved = evaluateExpression(match, data);
    if (resolved === null || resolved === undefined) return '';
    return String(resolved);
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
    const resolved = evaluateExpression(match, data);
    if (resolved === null || resolved === undefined) return '';
    return escapeHtml(String(resolved));
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

function extractFromExpression(expr: string, matches: string[]) {
  const trimmed = expr.trim();
  if (!trimmed) return;

  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return;
  }

  const fnMatch = trimmed.match(/^([A-Z_]+)\((.*)\)$/s);
  if (fnMatch) {
    const argsStr = fnMatch[2];
    const rawArgs = splitArguments(argsStr ?? '');
    for (const arg of rawArgs) {
      extractFromExpression(arg, matches);
    }
    return;
  }

  matches.push(trimmed);
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
      extractFromExpression(path, matches);
    }
  }

  return [...new Set(matches)]; // deduplicate
}
