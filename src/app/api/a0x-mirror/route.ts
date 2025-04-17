import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Get API configuration from environment variables
const A0X_API_URL = process.env.NEXT_PUBLIC_A0X_MIRROR_API_URL;
const A0X_API_KEY = process.env.NEXT_PUBLIC_A0X_MIRROR_API_KEY;

// Function to get CORS headers based on the request origin
function getCorsHeaders(requestHeaders: Headers) {
  const origin = requestHeaders.get('origin') || '';
  // In development, allow localhost. In production, only allow our domain
  const allowedOrigins = process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']
    : ['https://burntracker.xyz']; // Replace with your production domain

  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  } as const;
}

// Handle OPTIONS preflight request
export async function OPTIONS() {
  const headersList = headers();
  return NextResponse.json({}, { headers: getCorsHeaders(headersList) });
}

export async function GET() {
  try {
    // Check if API is configured
    if (!A0X_API_URL || !A0X_API_KEY) {
      throw new Error('A0X Mirror API configuration missing');
    }

    const headersList = headers();
    const corsHeaders = getCorsHeaders(headersList);

    // Forward the request to the A0X Mirror API
    const response = await fetch(`${A0X_API_URL}/agents`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${A0X_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('A0X Mirror API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Return the response with CORS headers
    return NextResponse.json(data, { 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('Error in a0x-mirror proxy:', error);
    
    // Get CORS headers for error response
    const corsHeaders = getCorsHeaders(headers());
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch from A0X Mirror API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    );
  }
} 