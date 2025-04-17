import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Add CORS headers to response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const headersList = headers();
    const referer = headersList.get('referer');
    const origin = headersList.get('origin');

    // Forward the request to the A0X Mirror API
    const response = await fetch('https://development-a0x-mirror-api-422317649866.us-central1.run.app/agents:1', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Origin': origin || '',
        'Referer': referer || '',
      },
    });

    if (!response.ok) {
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
    return NextResponse.json(
      { error: 'Failed to fetch from A0X Mirror API' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
} 