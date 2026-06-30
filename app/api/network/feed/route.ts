import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildFeedItems, type FeedItem } from '@/app/(app)/network/feedUtils'

const PAGE_SIZE = 50

// GET /api/network/feed?cursor=ISO_TIMESTAMP
// Returns the next page of feed items older than cursor.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cursor = request.nextUrl.searchParams.get('cursor') ?? new Date().toISOString()

  const admin = createAdminClient()
  const { items, hasMore } = await buildFeedItems(admin, user.id, cursor, PAGE_SIZE)

  return NextResponse.json({ items, hasMore } satisfies { items: FeedItem[]; hasMore: boolean })
}
