const DEFAULT_API_URL = 'http://localhost:4000';

export function getPublicApiUrl(
  env?: Record<string, string | undefined>,
): string {
  // Access process.env.NEXT_PUBLIC_API_URL directly so Next.js DefinePlugin inlines it in client bundles.
  const raw = (
    env !== undefined
      ? env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL
  )?.trim();
  const candidate = raw && raw.length > 0 ? raw : DEFAULT_API_URL;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_API_URL: expected http(s) URL, got "${candidate}"`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid NEXT_PUBLIC_API_URL protocol "${parsed.protocol}": expected http: or https:`,
    );
  }

  return candidate.replace(/\/+$/, '');
}
