// Audit Pipeline Phase 1: Extract concepts from dataset elements
// Called twice in parallel - once for D1, once for D2
// Returns concepts with linked element IDs via SSE streaming

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendSSE = async (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  (async () => {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

      const authHeader = req.headers.get("Authorization");
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
      });

      const { sessionId, projectId, shareToken, dataset, elements }: ExtractRequest = await req.json();
      
      const datasetLabel = dataset === "d1" ? "D1 (requirements)" : "D2 (implementation)";
      console.log(`[${dataset}] Starting extraction for ${elements.length} elements`);

      await sendSSE("progress", { 
        phase: `${dataset}_extraction`, 
        message: `Starting analysis of ${elements.length} ${datasetLabel} elements...`,
        progress: 0,
        elementCount: elements.length
      });

      // Build compact element list - truncate content for efficiency
      const elementsText = elements.map((e, i) => {
        const truncatedContent = (e.content || "").slice(0, 300);
        return `[${i + 1}] ID: ${e.id}\nLabel: ${e.label}\nCategory: ${e.category || "unknown"}\nContent: ${truncatedContent}${e.content && e.content.length > 300 ? "..." : ""}`;
      }).join("\n\n");

      await sendSSE("progress", { 
        phase: `${dataset}_extraction`, 
        message: `Built prompt with ${elements.length} elements, calling LLM...`,
        progress: 20
      });

      const prompt = `Extract common CONCEPTS from these ${datasetLabel} elements.

## Elements (${elements.length} total)
${elementsText}

## Task
Identify 5-15 high-level concepts that group these elements by theme/function.
Each element MUST be linked to at least one concept via its UUID.

## Required JSON Output
{
  "concepts": [
    {
      "label": "Short Concept Name",
      "description": "2-3 sentence explanation of what this concept covers and why the elements belong together",
      "elementIds": ["uuid1", "uuid2"]
    }
  ]
}

CRITICAL: 
- Every element UUID must appear in at least one concept
- Return ONLY valid JSON`;

      // Call Gemini
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${dataset}] Gemini error:`, response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      await sendSSE("progress", { 
        phase: `${dataset}_extraction`, 
        message: `Received LLM response, parsing...`,
        progress: 60
      });

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      console.log(`[${dataset}] Response length: ${rawText.length}`);

      // Parse JSON
      let parsed: { concepts: ExtractedConcept[] };
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr) {
        console.error(`[${dataset}] JSON parse failed, attempting recovery...`);
        const firstBrace = rawText.indexOf("{");
        const lastBrace = rawText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
        } else {
          throw new Error(`Failed to parse JSON from LLM response`);
        }
      }

      const concepts = parsed.concepts || [];
      console.log(`[${dataset}] Extracted ${concepts.length} concepts`);

      await sendSSE("progress", { 
        phase: `${dataset}_extraction`, 
        message: `Extracted ${concepts.length} concepts from ${elements.length} elements`,
        progress: 80,
        conceptCount: concepts.length
      });

      // Stream each concept as it's processed
      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];
        await sendSSE("concept", {
          index: i,
          total: concepts.length,
          label: concept.label,
          description: concept.description,
          elementCount: concept.elementIds.length
        });
      }

      // Log to blackboard
      await supabase.rpc("insert_audit_blackboard_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_agent_role: `${dataset}_extractor`,
        p_entry_type: `${dataset}_concepts`,
        p_content: `Extracted ${concepts.length} concepts:\n${concepts.map(c => `• ${c.label} (${c.elementIds.length} elements)`).join("\n")}`,
        p_iteration: 1,
        p_confidence: 0.9,
        p_evidence: null,
        p_target_agent: null,
      });

      // Log activity
      await supabase.rpc("insert_audit_activity_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_agent_role: `${dataset}_extractor`,
        p_activity_type: "concept_extraction",
        p_title: `${datasetLabel} Concept Extraction Complete`,
        p_content: `Extracted ${concepts.length} concepts from ${elements.length} elements`,
        p_metadata: { conceptCount: concepts.length, elementCount: elements.length, dataset },
      });

      await sendSSE("progress", { 
        phase: `${dataset}_extraction`, 
        message: `Complete! ${concepts.length} concepts extracted`,
        progress: 100
      });

      await sendSSE("result", { 
        success: true, 
        concepts, 
        dataset, 
        elementCount: elements.length 
      });
      
      await sendSSE("done", { success: true });

    } catch (error: unknown) {
      console.error("Concept extraction error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      await sendSSE("error", { message: errMsg });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
