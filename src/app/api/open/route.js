import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 1x1 transparent pixel GIF data
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

// UUID validation helper
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const letterId = searchParams.get('id')

  // Only process if we have a valid UUID
  if (letterId && isValidUUID(letterId)) {
    try {
      const supabase = createServerClient()

      // Update letter status to opened if not already opened or paid
      const { error: updateError } = await supabase
        .from('letters')
        .update({ 
          status: 'opened', 
          opened_at: new Date().toISOString() 
        })
        .eq('id', letterId)
        .in('status', ['sent']) // Only update if currently 'sent'

      if (updateError) {
        console.error('Error updating letter status:', updateError)
      }

      // Insert tracking event
      const { error: eventError } = await supabase
        .from('events')
        .insert({
          letter_id: letterId,
          type: 'opened'
        })

      if (eventError) {
        console.error('Error inserting tracking event:', eventError)
      }

    } catch (error) {
      console.error('Tracking pixel error:', error)
    }
  } else if (letterId && !isValidUUID(letterId)) {
    // Log invalid UUID attempts but don't process them
    console.log('Invalid UUID in tracking pixel request:', letterId)
  }

  // Always return the pixel, regardless of tracking success
  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': PIXEL_GIF.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

// Handle all HTTP methods (some email clients use POST)
export { GET as POST, GET as HEAD } 