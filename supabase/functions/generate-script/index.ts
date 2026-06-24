import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const REWRITE_PROMPT = `Using this viral content structure, rewrite the script for this product while keeping the same pacing and engagement style but making the content fully original and platform compliant.

You must return a JSON object with these exact fields:
{
  "script_15": "a 15-second version of the rewritten script",
  "script_30": "a 30-second version of the rewritten script",
  "script_60": "a 60-second version of the rewritten script",
  "hook_variations": ["3-5 different hook options for opening the video"],
  "cta_variations": ["3-5 different call-to-action options"],
  "caption": "an engaging social media caption with hashtags",
  "shot_list": [
    {"time": "0-3s", "description": "shot description", "type": "main"},
    {"time": "3-6s", "description": "shot description", "type": "broll"}
  ],
  "broll_suggestions": ["suggested b-roll footage ideas"],
  "teleprompter_script": "the full script formatted for teleprompter reading with natural pauses marked with ... and emphasis in CAPS"
}

Make the content original, engaging, and conversion-focused. Do NOT copy the original script directly - replicate the structure and pacing while making the content fresh and specific to the product.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { videoId, productId, scriptLength } = await req.json();

    if (!videoId || !productId) {
      return new Response(JSON.stringify({ error: "videoId and productId are required" }), {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseHeaders = {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "apikey": supabaseKey,
    };

    // Fetch video and product data
    const [videoRes, productRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/saved_videos?id=eq.${videoId}&select=*`, { headers: supabaseHeaders }),
      fetch(`${supabaseUrl}/rest/v1/products?id=eq.${productId}&select=*`, { headers: supabaseHeaders }),
    ]);

    const videoData = await videoRes.json();
    const productData = await productRes.json();

    const video = videoData[0];
    const product = productData[0];

    if (!video || !product) {
      return new Response(JSON.stringify({ error: "Video or product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videoContext = [
      `Video caption: ${video.caption || "N/A"}`,
      `Platform: ${video.platform}`,
      `Creator: @${video.creator_handle || "unknown"}`,
      video.transcript ? `Transcript: ${video.transcript}` : "",
      video.ai_summary ? `Analysis: ${JSON.stringify(video.ai_summary)}` : "",
    ].filter(Boolean).join("\n");

    const productContext = [
      `Product name: ${product.product_name}`,
      product.product_description ? `Description: ${product.product_description}` : "",
      product.benefits ? `Benefits: ${product.benefits}` : "",
      product.ingredients ? `Features/Ingredients: ${product.ingredients}` : "",
      product.category ? `Category: ${product.category}` : "",
      product.target_customer ? `Target customer: ${product.target_customer}` : "",
      product.brand_voice ? `Brand voice: ${product.brand_voice}` : "",
      product.pricing ? `Pricing: ${product.pricing}` : "",
      product.offer ? `Special offer: ${product.offer}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `${REWRITE_PROMPT}\n\nSource video analysis:\n${videoContext}\n\nProduct information:\n${productContext}\n\nPrimary script length requested: ${scriptLength || "30"}s\n\nGenerate all script variations and supporting content as JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert short-form video scriptwriter who specializes in viral content creation and conversion-focused copywriting. You understand TikTok, Instagram Reels, and YouTube Shorts formats. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
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

    let scriptData;
    try {
      scriptData = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse OpenAI response as JSON");
    }

    // Get user ID from the video
    const userId = video.user_id;

    // Save the generated script to the database
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/generated_scripts`, {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify({
        user_id: userId,
        video_id: videoId,
        product_id: productId,
        script_15: scriptData.script_15 || "",
        script_30: scriptData.script_30 || "",
        script_60: scriptData.script_60 || "",
        hook_variations: JSON.stringify(scriptData.hook_variations || []),
        cta_variations: JSON.stringify(scriptData.cta_variations || []),
        caption: scriptData.caption || "",
        shot_list: JSON.stringify(scriptData.shot_list || []),
        broll_suggestions: JSON.stringify(scriptData.broll_suggestions || []),
        teleprompter_script: scriptData.teleprompter_script || "",
        script_length: scriptLength || "30",
        status: "draft",
      }),
    });

    const inserted = await insertRes.json();
    const scriptId = inserted[0]?.id;

    return new Response(JSON.stringify({ scriptId, script: scriptData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
