import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '*';

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  const pathname = request.nextUrl.pathname;
  const isPublicGet =
    request.method === 'GET' &&
    (pathname.startsWith('/api/customer-app/products') ||
      pathname.startsWith('/api/customer-app/categories') ||
      pathname.startsWith('/api/customer-app/delivery-locations') ||
      pathname.startsWith('/api/customer-app/payment-methods'));

  // Strip authorization header for public requests to enable Vercel Edge caching
  let requestHeaders = request.headers;
  if (isPublicGet && request.headers.has('authorization')) {
    const headersList = new Headers(request.headers);
    headersList.delete('authorization');
    requestHeaders = headersList;
  }

  // Measure request size
  const reqSize = parseInt(request.headers.get('content-length') || '0', 10);
  const reqSizeKB = (reqSize / 1024).toFixed(2);

  // Handle actual request
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // Set Cache-Control for public GET routes so they are cached at the Edge
  if (isPublicGet) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    );
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
