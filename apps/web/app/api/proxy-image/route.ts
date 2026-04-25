import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';
import { URL } from 'node:url';

const ALLOWED_DOMAINS = ['cdninstagram.com', 'fbcdn.net'];
const CERT_ERROR_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
]);

type ProxyResponse = {
  status: number;
  contentType: string;
  body: ArrayBuffer;
};

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function getCauseCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function canUseInsecureTlsFallback(): boolean {
  if (process.env.PROXY_IMAGE_ALLOW_INSECURE_TLS === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

async function fetchWithNodeFetch(url: string): Promise<ProxyResponse> {
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BLDR/1.0)' },
  });

  return {
    status: upstream.status,
    contentType: upstream.headers.get('content-type') ?? 'image/jpeg',
    body: await upstream.arrayBuffer(),
  };
}

async function fetchWithHttpsModule(url: string): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BLDR/1.0)' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 502,
            contentType: Array.isArray(res.headers['content-type'])
              ? (res.headers['content-type'][0] ?? 'image/jpeg')
              : (res.headers['content-type'] ?? 'image/jpeg'),
            body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
          });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || !isAllowed(url)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    let upstream = await fetchWithNodeFetch(url);

    // In some local networks Node cannot validate Instagram/Facebook CDN cert chains.
    // Allow a controlled insecure fallback only outside production or when explicitly enabled.
    if (upstream.status >= 500 && canUseInsecureTlsFallback()) {
      upstream = await fetchWithHttpsModule(url);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type':                  upstream.contentType,
        'Cache-Control':                 'public, max-age=86400, immutable',
        'Cross-Origin-Resource-Policy':  'cross-origin',
      },
    });
  } catch (error) {
    const code = getCauseCode(error);
    if (code && CERT_ERROR_CODES.has(code) && canUseInsecureTlsFallback()) {
      try {
        const upstream = await fetchWithHttpsModule(url);
        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers: {
            'Content-Type':                  upstream.contentType,
            'Cache-Control':                 'public, max-age=86400, immutable',
            'Cross-Origin-Resource-Policy':  'cross-origin',
          },
        });
      } catch {
        // fall through to 502
      }
    }

    console.error('[proxy-image] upstream fetch failed', { url, code, error });
    return new NextResponse('Failed to fetch', { status: 502 });
  }
}
