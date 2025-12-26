// Audit Pipeline Phase 1: Extract concepts from dataset elements
// Simplified to return JSON directly (no SSE streaming)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_OUTPUT_TOKENS = 16384;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface DatasetElement {
  id: string;
  label: string;
  content: string;
  category?: string;
}

interface ExtractedConcept {
  label: string;
  description: string;
  elementIds: string[];
}

interface ExtractRequest {
  sessionId: string;
  projectId: string;
  shareToken: string;
  dataset: "d1" | "d2";
  elements: DatasetElement[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    const { sessionId, projectId, shareToken, dataset, elements }: ExtractRequest = await req.json();
    
    const datasetLabel = dataset === "d1" ? "requirements/specifications" : "implementation/code";
    
    // Calculate total content size
    const totalContentChars = elements.reduce((sum, e) => sum + (e.content?.length || 0), 0);
    const totalEstimatedTokens = Math.ceil(totalContentChars / 4);
    
    console.log(`[${dataset}] Starting extraction: ${elements.length} elements, ${totalContentChars.toLocaleString()} chars (~${totalEstimatedTokens.toLocaleString()} tokens)`);

    // Build element list with FULL content
    const elementsText = elements.map((e, i) => {
      return `[Element ${i + 1}]
ID: ${e.id}
Label: ${e.label}
Category: ${e.category || "unknown"}
Content:
${e.content || "(empty)"}`;
    }).join("\n\n---\n\n");

    const prompt = `You are analyzing ${datasetLabel} elements.

## Elements to analyze:
${elementsText}

## Task
Identify 2-8 high-level CONCEPTS that group these ${elements.length} elements by theme, purpose, or functionality.
Each concept should capture a meaningful grouping.
Every element MUST be assigned to at least one concept.

## Output Format (JSON only)
{
  "concepts": [
    {
      "label": "Concept Name (2-4 words)",
      "description": "Clear explanation of what this concept covers and why the elements belong together (2-3 sentences)",
      "elementIds": ["element-uuid-1", "element-uuid-2"]
    }
  ]
}

CRITICAL RULES:
1. Every element UUID listed above MUST appear in at least one concept's elementIds
2. Use the exact UUIDs from the elements
3. Return ONLY valid JSON, no other text`;

    // Log payload size
    const payloadChars = prompt.length;
    const estimatedTokens = Math.ceil(payloadChars / 4);
    console.log(`[${dataset}] Prompt: ${payloadChars.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens)`);

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    let concepts: ExtractedConcept[] = [];
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[${dataset}] Attempt ${attempt}/${MAX_RETRIES}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
        
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[${dataset}] Claude error (attempt ${attempt}):`, response.status, errorText);
          throw new Error(`Claude API error: ${response.status} - ${errorText.slice(0, 300)}`);
        }

        const result = await response.json();
        const rawText = result.content?.[0]?.text || "{}";
        
        console.log(`[${dataset}] Response: ${rawText.length} chars`);

        // Parse JSON with recovery
        let parsed: { concepts: ExtractedConcept[] };
        try {
          parsed = JSON.parse(rawText);
        } catch {
          console.error(`[${dataset}] JSON parse failed, attempting recovery...`);
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
          } else {
            throw new Error(`Failed to parse JSON from LLM response`);
          }
        }

        concepts = parsed.concepts || [];
        console.log(`[${dataset}] Extracted ${concepts.length} concepts`);
        break; // Success - exit retry loop
        
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === "AbortError";
        const errMsg = isAbort ? "Request timeout (3 min)" : (err.message || String(err));
        
        console.error(`[${dataset}] Attempt ${attempt}/${MAX_RETRIES} failed:`, errMsg);
        
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt;
          console.log(`[${dataset}] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // If all retries failed, return error
    if (concepts.length === 0 && lastError) {
      const errorMessage = lastError.message || String(lastError);
      console.error(`[${dataset}] All ${MAX_RETRIES} attempts failed:`, errorMessage);
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        dataset,
        elementCount: elements.length,
        concepts: [],
      }), {
        status: 200, // Return 200 so client can read error
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to blackboard
    try {
      await supabase.rpc("insert_audit_blackboard_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_agent_role: `${dataset}_extractor`,
        p_entry_type: `${dataset}_concepts`,
        p_content: `Extracted ${concepts.length} concepts from ${elements.length} elements:\n${concepts.map(c => `• ${c.label} (${c.elementIds.length} elements)`).join("\n")}`,
        p_iteration: 1,
        p_confidence: 0.9,
        p_evidence: null,
        p_target_agent: null,
      });
    } catch (e) {
      console.warn(`[${dataset}] Failed to log to blackboard:`, e);
    }

    // Log activity
    try {
      await supabase.rpc("insert_audit_activity_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_agent_role: `${dataset}_extractor`,
        p_activity_type: "concept_extraction",
        p_title: `${dataset === "d1" ? "D1" : "D2"} Concept Extraction Complete`,
        p_content: `Extracted ${concepts.length} concepts from ${elements.length} elements`,
        p_metadata: { 
          conceptCount: concepts.length, 
          elementCount: elements.length, 
          dataset,
          totalContentChars,
          totalEstimatedTokens
        },
      });
    } catch (e) {
      console.warn(`[${dataset}] Failed to log activity:`, e);
    }

    console.log(`[${dataset}] Returning ${concepts.length} concepts`);

    return new Response(JSON.stringify({
      success: true,
      concepts,
      dataset,
      elementCount: elements.length,
      totalContentChars,
      totalEstimatedTokens,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Concept extraction error:", errMsg, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
      concepts: [],
    }), {
      status: 200, // Return 200 so client can read error
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
