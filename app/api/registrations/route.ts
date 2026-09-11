import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const VALID_GAMES = ['Weiss Schwarz', 'Palworld OCG', 'Shadowverse Evolve', 'Cardfight!! Vanguard']

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`SELECT * FROM registrations ORDER BY created_at DESC`
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/registrations:', error)
    return NextResponse.json({ error: 'Failed to fetch registrations.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bushi_navi_id, handle_name, game } = body

    if (!bushi_navi_id || !handle_name || !game) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    if (!/^G\d{8}$/i.test(String(bushi_navi_id).trim())) {
      return NextResponse.json(
        { error: 'Bushi Navi ID must be in format GXXXXXXXX (G followed by 8 digits).' },
        { status: 400 }
      )
    }

    if (!VALID_GAMES.includes(game)) {
      return NextResponse.json({ error: 'Invalid game selection.' }, { status: 400 })
    }

    const sql = getDb()
    const normalized_id = String(bushi_navi_id).trim().toUpperCase()

    const existing = await sql`
      SELECT id FROM registrations
      WHERE UPPER(bushi_navi_id) = ${normalized_id}
        AND game = ${game}
        AND (created_at AT TIME ZONE 'Asia/Manila')::date = (NOW() AT TIME ZONE 'Asia/Manila')::date
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    }

    const rows = await sql`
      INSERT INTO registrations (bushi_navi_id, handle_name, game)
      VALUES (${normalized_id}, ${String(handle_name).trim()}, ${game})
      RETURNING *
    `

    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error('POST /api/registrations:', error)
    return NextResponse.json({ error: 'Failed to create registration.' }, { status: 500 })
  }
}
