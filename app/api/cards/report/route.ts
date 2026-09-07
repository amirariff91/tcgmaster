import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db/client";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = [
  "wrong_price",
  "variant_mismatch",
  "incorrect_link",
  "grade_confusion",
  "metadata_error",
  "other",
] as const;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const rateLimitKey = `ratelimit:report:${ip}`;

    // Rate limiting: 5 reports per minute per IP
    try {
      const current = await redis.incr(rateLimitKey);
      if (current === 1) {
        await redis.expire(rateLimitKey, 60);
      }
      if (current > 5) {
        return NextResponse.json(
          { error: "Too many reports submitted. Please wait a moment before trying again." },
          { status: 429 }
        );
      }
    } catch (err) {
      // Don't fail report submission if Redis is temporarily unreachable
      console.warn("Redis rate-limiting error:", err);
    }

    const body = await req.json();
    const { cardId, category, expectedPrice, suggestedUrl, description } = body;

    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json({ error: "Missing or invalid cardId." }, { status: 400 });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category. Must be one of the pre-configured issue types." },
        { status: 400 }
      );
    }

    // Verify card exists and capture current snapshot
    const cardRows = await dbQuery<{
      id: string;
      name: string;
      headline_cents: number | null;
      headline_source: string | null;
    }>(`
      SELECT c.id, c.name, cpc.headline_cents, cpc.headline_source
      FROM cards c
      LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
      WHERE c.id = $1
      LIMIT 1
    `, [cardId]);

    if (cardRows.length === 0) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    const card = cardRows[0];
    const priceSnapshot = card.headline_cents ?? null;
    const sourceSnapshot = card.headline_source ?? null;

    let parsedExpectedCents: number | null = null;
    if (expectedPrice !== undefined && expectedPrice !== null && expectedPrice !== "") {
      const num = parseFloat(String(expectedPrice).replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num >= 0) {
        parsedExpectedCents = Math.round(num * 100);
      }
    }

    const cleanUrl = suggestedUrl && typeof suggestedUrl === "string" && suggestedUrl.trim().startsWith("http")
      ? suggestedUrl.trim()
      : null;

    const cleanDesc = description && typeof description === "string"
      ? description.trim().substring(0, 1000)
      : null;

    // Insert report into database
    await dbQuery(`
      INSERT INTO card_accuracy_reports (
        card_id, category, expected_price_cents, suggested_url, description,
        current_price_snapshot, current_source_snapshot, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'pending', NOW()
      )
    `, [
      cardId,
      category,
      parsedExpectedCents,
      cleanUrl,
      cleanDesc,
      priceSnapshot,
      sourceSnapshot,
    ]);

    return NextResponse.json({
      success: true,
      message: "Thank you! Your accuracy report has been logged and queued for audit.",
    });
  } catch (err: unknown) {
    console.error("Error submitting card accuracy report:", err);
    return NextResponse.json(
      { error: "Failed to submit report. Please try again later." },
      { status: 500 }
    );
  }
}
