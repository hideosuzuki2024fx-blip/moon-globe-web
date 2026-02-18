import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

type CellRow = {
  cell_id: string;
  props: Record<string, unknown>;
  updated_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cellId = searchParams.get("cell_id");
  if (!cellId) {
    return NextResponse.json({ error: "cell_id is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT cell_id, props, updated_at
      FROM cells
      WHERE cell_id = ${cellId}
      LIMIT 1
    `) as CellRow[];

    return NextResponse.json({
      cell: rows[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch cell", details: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      cell_id?: string;
      props?: Record<string, unknown>;
    };

    if (!payload.cell_id) {
      return NextResponse.json({ error: "cell_id is required" }, { status: 400 });
    }

    const sql = getSql();
    const rows = (await sql`
      INSERT INTO cells (cell_id, props)
      VALUES (${payload.cell_id}, ${JSON.stringify(payload.props ?? {})}::jsonb)
      ON CONFLICT (cell_id)
      DO UPDATE
      SET props = EXCLUDED.props, updated_at = now()
      RETURNING cell_id, props, updated_at
    `) as CellRow[];

    return NextResponse.json({ cell: rows[0] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to upsert cell", details: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
