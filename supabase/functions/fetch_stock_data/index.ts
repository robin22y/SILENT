import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE!)

serve(async (req) => {
  try {
    const { ticker } = await req.json()
    if (!ticker) return new Response("Missing ticker", { status: 400 })

    // Check existing cache
    const { data: cached } = await supabase
      .from("stocks")
      .select("updated_at")
      .eq("ticker", ticker)
      .maybeSingle()

    let shouldUpdate = true

    if (cached?.updated_at) {
      const diffHours =
        (Date.now() - new Date(cached.updated_at).getTime()) / 3600000

      if (diffHours < 24) shouldUpdate = false
    }

    if (!shouldUpdate) {
      return new Response(JSON.stringify({ status: "cached" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch: price + volume + basic fundamentals (Yahoo)
    const yfRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
    )
    const yf = await yfRes.json()

    if (!yf.chart?.result) throw new Error("No Yahoo data")

    const result = yf.chart.result[0]
    const price = result.meta.regularMarketPrice
    const volume = result.meta.regularMarketVolume

    // Update Supabase
    await supabase.from("stocks").upsert(
      {
        ticker,
        price,
        volume,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ticker" }
    )

    return new Response(
      JSON.stringify({ status: "updated", price, volume }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

