import { describe, it, expect } from 'vitest';
import { interpolate, extractVariables } from '../../src/parser/interpolate.js';

describe('Formula & Expression Evaluator Engine', () => {
  const data = {
    title: 'Monthly Invoice',
    user: { name: 'Alice' },
    items: [
      { name: 'Apples', price: 10, count: 5 },
      { name: 'Bananas', price: 15, count: 2 },
      { name: 'Cherries', price: 25, count: 1 },
    ],
    x: 100,
    y: 20,
  };

  it('resolves plain variables normally', () => {
    expect(interpolate('Hello {{user.name}}', data)).toBe('Hello Alice');
    expect(interpolate('Title: {{title}}', data)).toBe('Title: Monthly Invoice');
  });

  it('supports SUM calculation on array fields', () => {
    // 10 + 15 + 25 = 50
    expect(interpolate('{{SUM(items, "price")}}', data)).toBe('50');
    // 5 + 2 + 1 = 8
    expect(interpolate('{{SUM(items, "count")}}', data)).toBe('8');
  });

  it('supports AVG calculation on array fields', () => {
    // (10 + 15 + 25) / 3 = 16.666666666666668
    expect(interpolate('{{AVG(items, "price")}}', data)).toBe(String(50 / 3));
  });

  it('supports COUNT calculation on arrays', () => {
    expect(interpolate('{{COUNT(items)}}', data)).toBe('3');
  });

  it('supports basic arithmetic operations (ADD, SUB, MUL, DIV)', () => {
    expect(interpolate('{{ADD(x, y)}}', data)).toBe('120');
    expect(interpolate('{{SUBTRACT(x, y)}}', data)).toBe('80');
    expect(interpolate('{{MULTIPLY(x, y)}}', data)).toBe('2000');
    expect(interpolate('{{DIVIDE(x, y)}}', data)).toBe('5');
  });

  it('supports ROUND function', () => {
    expect(interpolate('{{ROUND(AVG(items, "price"), 2)}}', data)).toBe('16.67');
    expect(interpolate('{{ROUND(AVG(items, "price"), 0)}}', data)).toBe('17');
  });

  it('supports FORMAT_CURRENCY function', () => {
    expect(interpolate('{{FORMAT_CURRENCY(SUM(items, "price"))}}', data)).toBe('$50.00');
    expect(interpolate('{{FORMAT_CURRENCY(SUM(items, "price"), "€")}}', data)).toBe('€50.00');
  });

  it('supports complex nested function compositions', () => {
    const template = 'Total to pay: {{FORMAT_CURRENCY(ROUND(SUM(items, "price"), 1))}}';
    expect(interpolate(template, data)).toBe('Total to pay: $50.00');
  });

  it('supports string and number literals in parameters', () => {
    expect(interpolate('{{ADD(10, 25.5)}}', data)).toBe('35.5');
    expect(interpolate('{{FORMAT_CURRENCY(1234.56, "£")}}', data)).toBe('£1,234.56');
  });

  it('extractVariables extracts recursively and ignores literals', () => {
    const template = '{{title}} - {{FORMAT_CURRENCY(SUM(items, "price"))}} - {{ADD(x, 100)}}';
    const vars = extractVariables(template);
    expect(vars).toEqual(['title', 'items', 'x']);
  });
});
