import { scrapeBlogText } from '@/lib/scraper'; // or correct path
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const result = await scrapeBlogText(url);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
