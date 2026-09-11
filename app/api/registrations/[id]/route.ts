import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getDb()
    await sql`DELETE FROM registrations WHERE id = ${params.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/registrations/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete registration.' }, { status: 500 })
  }
}
