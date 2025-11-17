import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, categoryId } = await req.json();
    console.log('AI Create Standards - Category:', categoryId);

    if (!input || !categoryId) {
      throw new Error('Input text and category ID are required');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get existing standards in this category to avoid duplicates
    const { data: existingStandards } = await supabase
      .from('standards')
      .select('code, title')
      .eq('category_id', categoryId);

    const existingCodes = existingStandards?.map(s => s.code) || [];
    const existingTitles = existingStandards?.map(s => s.title) || [];

    console.log('Calling Lovable AI for standards generation...');

    // Create comprehensive prompt for AI
    const prompt = `You are a standards architect. Analyze the following content and create comprehensive, hierarchical standards.

INPUT CONTENT:
${input}

INSTRUCTIONS:
1. Extract or create logical standards from this content
2. Organize them hierarchically (parent standards with child standards)
3. Create comprehensive descriptions for each standard
4. Assign appropriate standard codes (e.g., SEC-001, SEC-001.1, SEC-001.2)
5. Avoid duplicating these existing codes: ${existingCodes.join(', ')}
6. Avoid duplicating these existing titles: ${existingTitles.join(', ')}

IMPORTANT: Return a valid JSON array with this exact structure:
[
  {
    "code": "STD-001",
    "title": "Standard Title",
    "description": "Brief description",
    "content": "Detailed content explaining the standard",
    "children": [
      {
        "code": "STD-001.1",
        "title": "Sub-Standard Title",
        "description": "Brief description",
        "content": "Detailed content"
      }
    ]
  }
]

Return ONLY the JSON array, no other text.`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a standards architect that creates comprehensive, hierarchical standards. Always return valid JSON arrays." },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let generatedText = aiData.choices[0].message.content;

    console.log('AI Response received, parsing...');

    // Clean up the response to extract JSON
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let standardsData;
    try {
      standardsData = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Generated text:', generatedText);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!Array.isArray(standardsData)) {
      throw new Error('AI response is not an array');
    }

    console.log(`Parsed ${standardsData.length} top-level standards`);

    // Insert standards into database
    let createdCount = 0;

    const insertStandard = async (standard: any, parentId: string | null = null) => {
      const { data: insertedStandard, error: insertError } = await supabase
        .from('standards')
        .insert({
          category_id: categoryId,
          code: standard.code,
          title: standard.title,
          description: standard.description || null,
          content: standard.content || null,
          parent_id: parentId,
          order_index: createdCount
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting standard:', insertError);
        return null;
      }

      createdCount++;
      console.log(`Created standard: ${standard.code} - ${standard.title}`);

      // Recursively insert children
      if (standard.children && Array.isArray(standard.children)) {
        for (const child of standard.children) {
          await insertStandard(child, insertedStandard.id);
        }
      }

      return insertedStandard;
    };

    // Insert all standards
    for (const standard of standardsData) {
      await insertStandard(standard);
    }

    console.log(`Successfully created ${createdCount} standards`);

    return new Response(
      JSON.stringify({
        success: true,
        createdCount,
        message: `Created ${createdCount} standards successfully`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ai-create-standards function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
