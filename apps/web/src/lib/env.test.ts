import { expect, test } from 'vitest';
import { getPublicApiUrl } from './env';

test('API URL is public configuration', () => {
  expect(getPublicApiUrl({})).toBe('http://localhost:4000');
  expect(
    getPublicApiUrl({ NEXT_PUBLIC_API_URL: 'https://api.brewlite.dev/' }),
  ).toBe('https://api.brewlite.dev');
});
