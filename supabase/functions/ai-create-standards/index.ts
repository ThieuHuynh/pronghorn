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
    console.log('Input length:', input.length, 'characters');

    // Create prompt for AI - extract key principles only
    const prompt = `You are a standards architect. Analyze the following content and extract ONLY the key principles and main standards.

INPUT CONTENT:
${input}

INSTRUCTIONS:
1. Extract ONLY the key principles and core standards - do NOT create comprehensive hierarchies
2. Focus on main concepts and top-level requirements only
3. Create 5-10 key standards maximum with optional 1-2 sub-standards each
4. Keep descriptions brief (under 200 characters)
5. Keep content focused (under 500 characters)
6. Assign standard codes (e.g., SEC-001, SEC-001.1)
7. Avoid duplicating these existing codes: ${existingCodes.join(', ')}
8. Avoid duplicating these existing titles: ${existingTitles.join(', ')}

Return ONLY a valid JSON array with this structure (no markdown, no code blocks, just pure JSON):
[
  {
    "code": "STD-001",
    "title": "Standard Title",
    "description": "Brief description",
    "content": "Key details",
    "children": [
      {
        "code": "STD-001.1",
        "title": "Sub-Standard",
        "description": "Brief description",
        "content": "Key details"
      }
    ]
  }
]`;

    console.log('Prompt length:', prompt.length, 'characters');

    // Call Lovable AI without tool calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a standards architect that extracts key principles and creates focused, hierarchical standards. Always return valid JSON arrays only, no other text or formatting." },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 65535,
      }),
    });

    console.log('AI Response status:', aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway HTTP error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      throw new Error(`AI gateway HTTP error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');
    console.log('Response has error?', !!aiData.error);
    console.log('Response has choices?', !!aiData.choices);
    
    // Check for AI gateway errors
    if (aiData.error) {
      console.error('AI gateway returned error:', JSON.stringify(aiData.error, null, 2));
      if (aiData.error.code === 502) {
        throw new Error('AI provider temporarily unavailable. This may be due to a complex request. Please try again with a shorter document or simpler input.');
      }
      throw new Error(`AI gateway error: ${aiData.error.message || 'Unknown error'}`);
    }

    // Extract and parse JSON response
    let standardsData;
    try {
      if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
        console.error('Invalid AI response structure:', JSON.stringify(aiData, null, 2));
        throw new Error('Invalid AI response format - missing message content');
      }

      let generatedText = aiData.choices[0].message.content;
      console.log('Generated text length:', generatedText?.length || 0);
      console.log('Generated text preview:', generatedText?.substring(0, 200));
      
      if (!generatedText) {
        throw new Error('AI returned empty content');
      }

      // Clean up response - remove markdown code blocks
      generatedText = generatedText.trim();
      if (generatedText.startsWith('```json')) {
        generatedText = generatedText.slice(7);
      }
      if (generatedText.startsWith('```')) {
        generatedText = generatedText.slice(3);
      }
      if (generatedText.endsWith('```')) {
        generatedText = generatedText.slice(0, -3);
      }
      generatedText = generatedText.trim();
      
      console.log('Cleaned text length:', generatedText.length);
      console.log('Attempting JSON parse...');
      
      standardsData = JSON.parse(generatedText);
      
      if (!Array.isArray(standardsData)) {
        console.error('Parsed data is not an array:', typeof standardsData);
        throw new Error('AI response is not an array');
      }
      
      console.log(`Successfully parsed ${standardsData.length} top-level standards`);
    } catch (parseError) {
      console.error('Parse error details:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error('Parse error message:', errorMessage);
      throw new Error(`Failed to parse AI response: ${errorMessage}`);
    }

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
