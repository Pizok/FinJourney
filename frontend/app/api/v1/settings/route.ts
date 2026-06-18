import { NextResponse } from 'next/server'
import { MOCK_SETTINGS } from '@/components/settings/store/settingsStore'

export async function GET() {
  // Simulate a bit of network latency
  await new Promise((resolve) => setTimeout(resolve, 800))

  return NextResponse.json({
    success: true,
    data: MOCK_SETTINGS,
  })
}

export async function PATCH() {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return NextResponse.json({ success: true, message: 'Updated.' })
}
