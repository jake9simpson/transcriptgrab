import { NextRequest, NextResponse } from 'next/server';
import type { MetadataAPIResponse, VideoMetadata } from '@/lib/types';

interface NoembedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
}

function mapToMetadata(data: NoembedResponse): VideoMetadata | null {
  if (!data.title) return null;

  return {
    title: data.title,
    author: data.author_name ?? '',
    authorUrl: data.author_url ?? '',
    thumbnailUrl: data.thumbnail_url ?? '',
  };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json<MetadataAPIResponse>(
      { success: false, error: 'Missing url query parameter' },
      { status: 400 },
    );
  }

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return NextResponse.json<MetadataAPIResponse>(
      { success: false, error: 'Only YouTube URLs are supported' },
      { status: 400 },
    );
  }

  // Try noembed first
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data: NoembedResponse = await res.json();
      const metadata = mapToMetadata(data);
      if (metadata) {
        return NextResponse.json<MetadataAPIResponse>({ success: true, data: metadata });
      }
    }
  } catch {
    // Fall through to oembed fallback
  }

  // Fallback to YouTube oembed
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (res.ok) {
      const data: NoembedResponse = await res.json();
      const metadata = mapToMetadata(data);
      if (metadata) {
        return NextResponse.json<MetadataAPIResponse>({ success: true, data: metadata });
      }
    }
  } catch {
    // Fall through to error response
  }

  return NextResponse.json<MetadataAPIResponse>(
    { success: false, error: 'Could not fetch video metadata' },
    { status: 502 },
  );
}
