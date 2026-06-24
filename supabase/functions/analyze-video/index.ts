import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANALYSIS_PROMPT = `Analyze this short-form video. Extract the hook, pacing, emotional triggers, visual flow, CTA structure, and conversion psychology. Explain why the video performs well.

Return your analysis as a JSON object with these exact fields:
{
  "hook": "description of the opening hook and why it grabs attention",
  "problem": "the problem or pain point introduced",
  "emotional_trigger": "the primary emotion the content evokes",
  "product_positioning": "how the product or solution is positioned",
  "visual_flow": "description of the visual structure and transitions",
  "cta": "the call-to-action strategy used",
  "tone": "the overall tone of the content",
  "pacing": "description of the content pacing",
  "script_structure": "breakdown of the script structure (intro, body, close)",
  "key_moments": ["array of key moments or beats in the content"],
  "why_it_performs": "analysis of why this content performs well"
}

Be specific, actionable, and focused on what makes this content work from a conversion and engagement perspective.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { videoId, videoUrl, caption, platform } = await req.json();

    if (!videoId) {
      return new Response(JSON.stringify({ error: "videoId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContext = [
      caption ? `Video caption: ${caption}` : "",
      platform ? `Platform: ${platform}` : "",
      videoUrl ? `Video URL: ${videoUrl}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `${ANALYSIS_PROMPT}\n\nVideo context:\n${userContext}\n\nProvide a detailed analysis as JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert short-form video analyst. You understand viral content structure, TikTok/Instagram/YouTube algorithms, and conversion psychology. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse OpenAI response as JSON");
    }

    // Decrement AI credits
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${supabaseUrl}/rest/v1/rpc/decrement_credits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "apikey": supabaseKey,
      },
      body: JSON.stringify({ user_id: req.headers.get("x-user-id") }),
    }).catch(() => {});

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
