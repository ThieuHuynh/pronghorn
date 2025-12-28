// Audit Pipeline Phase 2 V2: Complete merge system rebuild
// SINGLE SOURCE OF TRUTH: This edge function returns the COMPLETE concept list
// with explicit d1Ids/d2Ids. Client rebuilds graph entirely from this response.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Unified concept - tracks both D1 and D2 element IDs
export interface UnifiedConcept {
  label: string;
  description: string;
  d1Ids: string[];
  d2Ids: string[];
  elementLabels?: string[];
}

interface MergeLogEntry {
  from: string[];      // Source concept labels that were merged
  to: string;          // New merged concept label
}

interface MergeRequest {
  sessionId: string;
  projectId: string;
  shareToken: string;
  concepts: UnifiedConcept[];
  round: number;
  totalRounds: number;
}

interface MergeResponse {
  concepts: UnifiedConcept[];     // Complete list of concepts after merge
  mergeLog: MergeLogEntry[];      // What merges happened (for UI display)
  inputCount: number;
  outputCount: number;
  d1ElementCount: number;         // Total D1 elements across all concepts
  d2ElementCount: number;         // Total D2 elements across all concepts
}

interface ProjectSettings {
  selected_model: string | null;
  max_tokens: number | null;
}

// Model routing helper
function getModelConfig(selectedModel: string): { 
  apiType: "anthropic" | "gemini" | "xai"; 
  modelName: string;
  apiKeyEnv: string;
} {
  if (selectedModel.startsWith("claude")) {
    return { apiType: "anthropic", modelName: selectedModel, apiKeyEnv: "ANTHROPIC_API_KEY" };
  } else if (selectedModel.startsWith("gemini")) {
    return { apiType: "gemini", modelName: selectedModel, apiKeyEnv: "GEMINI_API_KEY" };
  } else if (selectedModel.startsWith("grok")) {
    return { apiType: "xai", modelName: selectedModel, apiKeyEnv: "XAI_API_KEY" };
  }
  return { apiType: "gemini", modelName: "gemini-2.5-flash", apiKeyEnv: "GEMINI_API_KEY" };
}

// Call LLM based on model type
async function callLLM(
  prompt: string,
  config: { apiType: "anthropic" | "gemini" | "xai"; modelName: string; apiKeyEnv: string },
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get(config.apiKeyEnv);
  if (!apiKey) throw new Error(`API key not configured: ${config.apiKeyEnv}`);

  if (config.apiType === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    const result = await response.json();
    return result.content?.[0]?.text || "{}";
  } else if (config.apiType === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  } else {
    // xAI/Grok
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || "{}";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendSSE = async (event: string, data: any) => {
    const message = `event: ${event}\n data: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  (async () => {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const authHeader = req.headers.get("Authorization");
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
      });

      const { sessionId, projectId, shareToken, concepts, round, totalRounds }: MergeRequest = await req.json();

      // Get project settings for model configuration
      const { data: project } = await supabase.rpc("get_project_with_token", {
        p_project_id: projectId,
        p_token: shareToken,
      }) as { data: ProjectSettings | null };

      const selectedModel = project?.selected_model || "gemini-2.5-flash";
      const maxTokens = project?.max_tokens || 16384;
      const modelConfig = getModelConfig(selectedModel);

      // Count input elements (for verification)
      const inputD1Count = concepts.reduce((sum, c) => sum + (c.d1Ids?.length || 0), 0);
      const inputD2Count = concepts.reduce((sum, c) => sum + (c.d2Ids?.length || 0), 0);
      
      console.log(`[merge-v2] Round ${round}/${totalRounds} using ${selectedModel}`);
      console.log(`[merge-v2] INPUT: ${concepts.length} concepts, ${inputD1Count} D1 elements, ${inputD2Count} D2 elements`);
      
      await sendSSE("progress", { 
        phase: "concept_merge", 
        message: `Round ${round}/${totalRounds}: Analyzing ${concepts.length} concepts...`, 
        progress: 10 
      });

      // Build concept text for LLM
      const conceptsText = concepts.map((c, i) => {
        const d1Count = c.d1Ids?.length || 0;
        const d2Count = c.d2Ids?.length || 0;
        const sourceInfo = d1Count > 0 && d2Count > 0 
          ? `[BOTH: ${d1Count} D1 + ${d2Count} D2]`
          : d1Count > 0 
            ? `[D1-only: ${d1Count} elements]` 
            : `[D2-only: ${d2Count} elements]`;
        
        const elementsPreview = c.elementLabels && c.elementLabels.length > 0 
          ? `\n  Elements: ${c.elementLabels.slice(0, 3).map(el => el.slice(0, 60)).join("; ")}${c.elementLabels.length > 3 ? ` (+${c.elementLabels.length - 3} more)` : ""}`
          : "";
        return `${i + 1}. "${c.label}" ${sourceInfo}\n  Description: ${c.description}${elementsPreview}`;
      }).join("\n\n");

      // Round-specific merge criteria
      const roundCriteria: Record<number, { label: string; criteria: string }> = {
        1: { 
          label: "EXACT MATCHING", 
          criteria: `Only merge concepts that are:
- Nearly identical names (e.g., "User Auth" and "User Authentication")
- Obvious duplicates with minor wording differences
- Clearly the same concept described differently` 
        },
        2: { 
          label: "THEMATIC MATCHING", 
          criteria: `Merge concepts that are:
- Thematically related (e.g., "Login Flow" + "Session Management" → "Authentication System")
- Part of the same functional domain
- Logically connected sub-concepts` 
        },
        3: { 
          label: "AGGRESSIVE CONSOLIDATION", 
          criteria: `Aggressively merge into broad categories:
- Combine related domains (e.g., "Auth", "Permissions", "Roles" → "Access Control")
- Create high-level concepts
- Target 5-15 final concepts
- When in doubt, MERGE` 
        },
      };
      
      const { label: roundLabel, criteria } = roundCriteria[round] || roundCriteria[1];
      
      const prompt = `You are merging concepts. Round ${round}/${totalRounds}: ${roundLabel}

**MERGE CRITERIA:**
${criteria}

**Current concepts (${concepts.length} total):**

${conceptsText}

## Your Task

Identify which concepts should be MERGED. For each merge:
1. List the source concept names (EXACT names from the list above)
2. Provide the new merged label
3. Provide a merged description

**CRITICAL RULES:**
- Each concept can appear in AT MOST ONE merge group
- Only output merges for 2+ concepts being combined
- Concepts not listed in any merge will pass through unchanged
- Use the EXACT concept names from the list (the quoted text after the number)

## Output Format

Return JSON:
{
  "merges": [
    {
      "sourceConcepts": ["User Authentication", "Login System"],
      "mergedLabel": "Authentication & Login",
      "mergedDescription": "Handles user authentication and login functionality"
    }
  ]
}

If no merges should happen, return: {"merges": []}

Return ONLY the JSON object.`;

      await sendSSE("progress", { phase: "concept_merge", message: `Calling ${selectedModel}...`, progress: 30 });

      const rawText = await callLLM(prompt, modelConfig, maxTokens);
      
      console.log(`[merge-v2] LLM response (${rawText.length} chars)`);
      
      await sendSSE("progress", { phase: "concept_merge", message: "Processing merge instructions...", progress: 60 });

      // Parse JSON
      let parsed: { merges: Array<{ sourceConcepts: string[]; mergedLabel: string; mergedDescription: string }> };
      try {
        parsed = JSON.parse(rawText);
      } catch {
        console.error("[merge-v2] JSON parse failed, attempting recovery...");
        const firstBrace = rawText.indexOf("{");
        const lastBrace = rawText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
        } else {
          throw new Error("Could not parse JSON from LLM response");
        }
      }

      // Build concept lookup map (lowercase label -> concept)
      const conceptByLabel = new Map<string, UnifiedConcept>();
      for (const c of concepts) {
        conceptByLabel.set(c.label.toLowerCase(), c);
      }

      // Track which concepts were merged (by lowercase label)
      const mergedLabels = new Set<string>();
      
      // Build output concept list and merge log
      const outputConcepts: UnifiedConcept[] = [];
      const mergeLog: MergeLogEntry[] = [];

      // Process each merge instruction
      for (const m of (parsed.merges || [])) {
        const validSources: UnifiedConcept[] = [];
        const validSourceLabels: string[] = [];
        
        for (const label of (m.sourceConcepts || [])) {
          const key = label.toLowerCase();
          
          // Skip if already used in another merge
          if (mergedLabels.has(key)) {
            console.log(`[merge-v2] SKIP: "${label}" already merged`);
            continue;
          }
          
          const found = conceptByLabel.get(key);
          if (found) {
            validSources.push(found);
            validSourceLabels.push(found.label); // Use original case
            mergedLabels.add(key);
          } else {
            console.log(`[merge-v2] NOT FOUND: "${label}"`);
          }
        }
        
        // Only create merged concept if 2+ valid sources
        if (validSources.length >= 2) {
          // Combine all element IDs from source concepts (dedupe with Set)
          const combinedD1Ids = [...new Set(validSources.flatMap(c => c.d1Ids || []))];
          const combinedD2Ids = [...new Set(validSources.flatMap(c => c.d2Ids || []))];
          const combinedLabels = [...new Set(validSources.flatMap(c => c.elementLabels || []))];
          
          const mergedConcept: UnifiedConcept = {
            label: m.mergedLabel,
            description: m.mergedDescription,
            d1Ids: combinedD1Ids,
            d2Ids: combinedD2Ids,
            elementLabels: combinedLabels,
          };
          outputConcepts.push(mergedConcept);
          
          // Add to merge log for UI
          mergeLog.push({
            from: validSourceLabels,
            to: m.mergedLabel,
          });
          
          console.log(`[merge-v2] MERGED: "${m.mergedLabel}" ← [${validSourceLabels.join(", ")}] (${combinedD1Ids.length} D1, ${combinedD2Ids.length} D2)`);
        } else if (validSources.length === 1) {
          // Only 1 valid source - unmark it so it passes through unchanged
          mergedLabels.delete(validSources[0].label.toLowerCase());
          console.log(`[merge-v2] UNMERGE: "${validSources[0].label}" (only 1 valid source)`);
        }
      }

      // Add all concepts that weren't merged (pass-through unchanged)
      for (const c of concepts) {
        if (!mergedLabels.has(c.label.toLowerCase())) {
          outputConcepts.push(c);
        }
      }

      // ========================================
      // CRITICAL VERIFICATION: No element loss
      // ========================================
      const outputD1Count = outputConcepts.reduce((sum, c) => sum + (c.d1Ids?.length || 0), 0);
      const outputD2Count = outputConcepts.reduce((sum, c) => sum + (c.d2Ids?.length || 0), 0);
      
      console.log(`[merge-v2] OUTPUT: ${outputConcepts.length} concepts, ${outputD1Count} D1 elements, ${outputD2Count} D2 elements`);
      
      if (outputD1Count !== inputD1Count) {
        console.error(`[merge-v2] ❌ D1 ELEMENT LOSS: ${inputD1Count} in → ${outputD1Count} out`);
      }
      if (outputD2Count !== inputD2Count) {
        console.error(`[merge-v2] ❌ D2 ELEMENT LOSS: ${inputD2Count} in → ${outputD2Count} out`);
      }
      if (outputD1Count === inputD1Count && outputD2Count === inputD2Count) {
        console.log(`[merge-v2] ✅ Element counts verified: ${outputD1Count} D1, ${outputD2Count} D2`);
      }

      await sendSSE("progress", { phase: "concept_merge", message: "Merge complete", progress: 90 });

      // Write to activity stream
      await supabase.rpc("insert_audit_activity_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_agent_role: "concept_merger_v2",
        p_activity_type: "concept_merge",
        p_title: `Round ${round}/${totalRounds}: ${concepts.length} → ${outputConcepts.length} concepts`,
        p_content: mergeLog.length > 0 
          ? `Merges:\n${mergeLog.map(m => `• ${m.to} ← [${m.from.join(", ")}]`).join("\n")}`
          : "No merges in this round",
        p_metadata: { 
          round,
          totalRounds,
          inputCount: concepts.length,
          outputCount: outputConcepts.length,
          mergeCount: mergeLog.length,
          d1ElementCount: outputD1Count,
          d2ElementCount: outputD2Count,
          model: selectedModel,
        },
      });

      // Return complete result
      const response: MergeResponse = {
        concepts: outputConcepts,
        mergeLog,
        inputCount: concepts.length,
        outputCount: outputConcepts.length,
        d1ElementCount: outputD1Count,
        d2ElementCount: outputD2Count,
      };

      await sendSSE("result", response);
      await sendSSE("done", { success: true });

    } catch (error: unknown) {
      console.error("[merge-v2] Error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      try {
        await sendSSE("error", { message: errMsg });
      } catch {
        // Stream may be closed
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
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
