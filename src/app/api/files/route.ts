import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET /api/files?path=uploads/xxx/file.pdf
// Creates a signed URL for a private storage file and redirects to it
export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 3600) // 1 hour expiry

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
