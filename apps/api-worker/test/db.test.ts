import { describe, expect, it } from 'vitest';
import { normalizeParams, parsePgArray, serializePgArray } from '../src/db';

describe('Postgres array text format', () => {
  it('parses simple, quoted, empty and NULL elements', () => {
    expect(parsePgArray('{}')).toEqual([]);
    expect(parsePgArray('{read,write}')).toEqual(['read', 'write']);
    expect(parsePgArray('{"a b","c,d",NULL,plain}')).toEqual(['a b', 'c,d', null, 'plain']);
    expect(parsePgArray('{"say \\"hi\\"","back\\\\slash"}')).toEqual(['say "hi"', 'back\\slash']);
  });

  it('parses numbers with an element converter', () => {
    expect(parsePgArray('{1,2,30}', Number)).toEqual([1, 2, 30]);
  });

  it('serialises values so that quotes, commas and backslashes survive a round trip', () => {
    const values = ['plain', 'with space', 'a,b', 'say "hi"', 'back\\slash', ''];
    expect(parsePgArray(serializePgArray(values))).toEqual(values);
    expect(serializePgArray([])).toBe('{}');
    expect(serializePgArray(['x', null])).toBe('{"x",NULL}');
  });
});

describe('parameter normalisation', () => {
  it('turns arrays into Postgres array literals and leaves everything else alone', () => {
    const when = new Date('2026-01-01T00:00:00Z');
    expect(normalizeParams([['pending', 'rejected'], 'x', 5, null, when, ['a b']])).toEqual(['{"pending","rejected"}', 'x', 5, null, when, '{"a b"}']);
  });
});
