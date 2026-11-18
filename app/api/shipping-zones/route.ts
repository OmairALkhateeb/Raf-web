import { NextResponse } from 'next/server';
import { fetchShippingZones } from '@/lib/api/server/shipping-zones';

/** The backend's delivery cities for the address form (H3). */
export async function GET() {
  const zones = await fetchShippingZones();
  if (zones === null) {
    return NextResponse.json({ zones: null }, { status: 503 });
  }
  return NextResponse.json({ zones });
}
