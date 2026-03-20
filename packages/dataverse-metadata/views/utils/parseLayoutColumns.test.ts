// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { parseLayoutColumns } from './parseLayoutColumns';

describe('parseLayoutColumns', () => {
  it('returns empty array for null input', () => {
    expect(parseLayoutColumns(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseLayoutColumns(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseLayoutColumns('')).toEqual([]);
  });

  it('parses a valid layoutxml with multiple cells', () => {
    const xml = `<grid><row><cell name="name" width="300" /><cell name="telephone1" width="150" /></row></grid>`;
    expect(parseLayoutColumns(xml)).toEqual([
      { name: 'name', width: 300 },
      { name: 'telephone1', width: 150 },
    ]);
  });

  it('defaults width to 100 when width attribute is absent', () => {
    const xml = `<grid><row><cell name="statecode" /></row></grid>`;
    expect(parseLayoutColumns(xml)).toEqual([{ name: 'statecode', width: 100 }]);
  });

  it('defaults width to 100 when width attribute is not a number', () => {
    const xml = `<grid><row><cell name="foo" width="bad" /></row></grid>`;
    expect(parseLayoutColumns(xml)).toEqual([{ name: 'foo', width: 100 }]);
  });

  it('skips cells without a name attribute', () => {
    const xml = `<grid><row><cell width="100" /><cell name="emailaddress1" width="200" /></row></grid>`;
    expect(parseLayoutColumns(xml)).toEqual([{ name: 'emailaddress1', width: 200 }]);
  });

  it('returns empty array for malformed XML', () => {
    expect(parseLayoutColumns('<grid><row><cell name="foo" width=')).toEqual([]);
  });
});
