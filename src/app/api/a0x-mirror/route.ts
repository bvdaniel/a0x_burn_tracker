import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_A0X_MIRROR_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_A0X_MIRROR_API_KEY;

export async function GET() {
  try {
    if (!API_URL || !API_KEY) {
      return NextResponse.json(
        { error: 'API configuration missing' },
        { status: 500 }
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
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 