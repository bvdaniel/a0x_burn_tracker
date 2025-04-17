import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_A0X_MIRROR_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_A0X_MIRROR_API_KEY;

export async function GET() {
  try {
    // Get the request headers
    const headersList = headers();
    const origin = headersList.get('origin') || '';

    // Common response headers
    const responseHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (!API_URL || !API_KEY) {
      console.error('API configuration missing');
      return NextResponse.json(
        { error: 'API configuration missing' },
        { 
          status: 500,
          headers: responseHeaders
        }
      );
    }

    const response = await fetch(`${API_URL}/agents`, {
      headers: {
        'User-Agent': 'burntracker/1.0',
        'x-api-key': API_KEY,
        'Accept': 'application/json'
      },
      // Cache the response for 5 minutes
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('A0x Mirror API error:', error);
      return NextResponse.json(
        { error: `API request failed: ${response.status}` },
        { 
          status: response.status,
          headers: responseHeaders
        }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  const headersList = headers();
  const origin = headersList.get('origin') || '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 