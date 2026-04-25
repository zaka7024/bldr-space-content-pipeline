import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_DOMAINS = ['cdninstagram.com', 'fbcdn.net'];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || !isAllowed(url)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BLDR/1.0)' },
    });

    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type':                  contentType,
        'Cache-Control':                 'public, max-age=86400, immutable',
        'Cross-Origin-Resource-Policy':  'cross-origin',
      },
    });
  } catch {
    return new NextResponse('Failed to fetch', { status: 502 });
  }
}
