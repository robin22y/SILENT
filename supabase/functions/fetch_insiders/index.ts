import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const client = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  const { ticker } = await req.json()
  if (!ticker) return new Response("Missing", { status: 400 })

  try {
    // Try finviz first
    const url = `https://finviz.com/insidertrading.ashx?t=${ticker}`
    const html = await fetch(url).then((r) => r.text())

    // finviz blocked?
    if (html.includes("Access denied") || html.includes("captcha")) {
      return new Response(JSON.stringify({ finviz: "blocked" }), {
        status: 429,
      })
    }

    // parse later with cheerio
    // ...

    // TODO: EDGAR fallback

    return new Response(JSON.stringify({ status: "ok" }))
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})

