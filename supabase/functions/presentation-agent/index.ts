import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PresentationRequest {
  projectId: string;
  presentationId: string;
  shareToken: string;
  mode: "concise" | "detailed";
  targetSlides: number;
  initialPrompt?: string;
}

interface BlackboardEntry {
  id: string;
  timestamp: string;
  source: string;
  category: "observation" | "insight" | "question" | "decision" | "estimate" | "analysis" | "narrative";
  content: string;
  data?: Record<string, any>;
}

interface ToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
  blackboardEntries: BlackboardEntry[];
}

interface SlideContent {
  regionId: string;
  type: string;
  data: any;
}

interface GeneratedSlide {
  id: string;
  order: number;
  layoutId: string;
  title: string;
  subtitle?: string;
  content: SlideContent[];
  notes?: string;
  imageUrl?: string;
  imagePrompt?: string;
}

// NEW: Slide outline for incremental generation
interface SlideOutline {
  order: number;
  layoutId: string;
  title: string;
  purpose: string;
  imagePrompt?: string;
  keyContent: string[];
}

// Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Create SSE message
function sseMessage(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Battle-tested JSON parser from coding-agent-orchestrator
function parseAgentResponseText(rawText: string): any {
  const originalText = rawText.trim();
  let text = originalText;

  console.log("Parsing agent response, length:", rawText.length);
  console.log("Raw preview:", rawText.slice(0, 300) + (rawText.length > 300 ? "..." : ""));

  const tryParse = (jsonStr: string, method: string): any | null => {
    try {
      const parsed = JSON.parse(jsonStr);
      console.log(`JSON parsed successfully via ${method}`);
      return parsed;
    } catch (e) {
      console.log(`JSON.parse failed in ${method}:`, (e as Error).message);
      return null;
    }
  };

  // Method 1: Direct parse
  let result = tryParse(text, "direct parse");
  if (result) return result;

  // Method 2: Extract from LAST ```json fence
  const lastFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```[\s\S]*$/i);
  if (lastFenceMatch?.[1]) {
    const extracted = lastFenceMatch[1].trim();
    const cleaned = extracted
      .replace(/^[\s\n]*here.?is.?the.?json.?[:\s]*/i, "")
      .replace(/^[\s\n]*json[:\s]*/i, "")
      .trim();
    result = tryParse(cleaned, "last code fence");
    if (result) return result;
  }

  // Method 3: Find ALL code blocks and try each (reverse order)
  const allFences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (let i = allFences.length - 1; i >= 0; i--) {
    const content = allFences[i][1].trim();
    if (content) {
      result = tryParse(content, `code fence #${i + 1} (reverse)`);
      if (result) return result;
    }
  }

  // Method 4: Brace/bracket matching (arrays for slides)
  const firstBracket = originalText.indexOf("[");
  const lastBracket = originalText.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = originalText.slice(firstBracket, lastBracket + 1);
    result = tryParse(candidate, "bracket extraction (array)");
    if (result) return result;
  }

  // Method 5: Brace matching (objects)
  const firstBrace = originalText.indexOf("{");
  const lastBrace = originalText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = originalText.slice(firstBrace, lastBrace + 1);
    result = tryParse(candidate, "brace extraction (raw)");
    if (result) return result;

    const cleaned = candidate.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    result = tryParse(cleaned, "brace extraction (cleaned)");
    if (result) return result;
  }

  console.error("All JSON parsing methods failed for response:", originalText.slice(0, 1000));
  return null;
}

// Generate slide image using the enhance-image edge function
async function generateSlideImage(
  prompt: string, 
  supabaseUrl: string, 
  supabaseKey: string
): Promise<string | null> {
  try {
    console.log(`🎨 Generating slide image for: "${prompt.substring(0, 100)}..."`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/enhance-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        prompt: `Professional presentation visual: ${prompt}. High quality, clean, modern design suitable for a business presentation slide.`,
        model: "gemini-2.5-flash-image",
        images: [], // No source images, pure generation
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation failed:", response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log("✅ Slide image generated successfully");
    return data.imageUrl; // Returns base64 data URL
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

// Get layout regions for a specific layout
function getLayoutRegions(layoutId: string): string {
  const layoutRegions: Record<string, string> = {
    "title-cover": "background(image), title(heading), subtitle(text), date(text)",
    "section-divider": "section-number(heading), title(heading), subtitle(text)",
    "title-content": "title(heading), content(richtext)",
    "two-column": "title(heading), left-content(richtext), right-content(richtext)",
    "image-left": "title(heading), image(image), content(richtext)",
    "image-right": "title(heading), content(richtext), image(image)",
    "stats-grid": "title(heading), stat-1(stat), stat-2(stat), stat-3(stat), stat-4(stat)",
    "bullets": "title(heading), bullets(bullets)",
    "quote": "quote(text), attribution(text)",
    "architecture": "title(heading), diagram(image)",
    "comparison": "title(heading), left-header(heading), right-header(heading), left-content(bullets), right-content(bullets)",
    "timeline": "title(heading), timeline(timeline)",
    "icon-grid": "title(heading), subtitle(text), grid(icon-grid)",
    "table": "title(heading), table(table)",
    "chart-full": "title(heading), chart(chart)",
  };
  return layoutRegions[layoutId] || "title(heading), content(richtext)";
}

// Get relevant blackboard data for a specific slide
function getRelevantDataForSlide(
  outline: SlideOutline,
  blackboard: BlackboardEntry[],
  collectedData: Record<string, any>
): string {
  const lowerPurpose = outline.purpose.toLowerCase();
  const lowerTitle = outline.title.toLowerCase();
  
  // Find related blackboard entries
  const relevantEntries = blackboard.filter(e => {
    const lowerContent = e.content.toLowerCase();
    return (
      outline.keyContent.some(kc => lowerContent.includes(kc.toLowerCase())) ||
      lowerContent.includes(lowerTitle) ||
      lowerContent.includes(lowerPurpose)
    );
  });

  const parts: string[] = [];
  
  // Add relevant blackboard entries
  if (relevantEntries.length > 0) {
    parts.push("RELATED INSIGHTS:");
    parts.push(...relevantEntries.slice(0, 5).map(e => `- [${e.category}] ${e.content}`));
  }

  // Add specific data based on slide purpose
  if (lowerPurpose.includes("requirement") || lowerTitle.includes("requirement")) {
    const reqs = (collectedData.requirements || []).filter((r: any) => !r.parent_id).slice(0, 8);
    if (reqs.length > 0) {
      parts.push("\nKEY REQUIREMENTS:");
      parts.push(...reqs.map((r: any) => `- ${r.code || ""} ${r.title}: ${(r.content || "").slice(0, 100)}`));
    }
  }

  if (lowerPurpose.includes("architecture") || lowerTitle.includes("architecture")) {
    const nodes = (collectedData.canvas?.nodes || []).slice(0, 10);
    if (nodes.length > 0) {
      parts.push("\nARCHITECTURE COMPONENTS:");
      parts.push(...nodes.map((n: any) => `- ${n.type}: ${n.data?.label || n.data?.title || "Unnamed"}`));
    }
  }

  if (lowerPurpose.includes("status") || lowerPurpose.includes("metric") || lowerTitle.includes("status")) {
    parts.push("\nPROJECT METRICS:");
    parts.push(`- Requirements: ${collectedData.requirements?.length || 0}`);
    parts.push(`- Architecture Components: ${collectedData.canvas?.nodes?.length || 0}`);
    parts.push(`- Code Files: ${collectedData.repoStructure?.files?.length || 0}`);
    parts.push(`- Specifications: ${collectedData.specifications?.length || 0}`);
    parts.push(`- Deployments: ${collectedData.deployments?.length || 0}`);
  }

  return parts.join("\n") || "Use the slide purpose and key content to create relevant material.";
}

// Build structured story arc based on target slides
function buildStoryStructure(targetSlides: number, mode: string): { section: string; slideCount: number; layouts: string[]; purpose: string }[] {
  // Define the narrative structure
  const sections = [
    { section: "Opening", purpose: "Set the stage and capture attention", minSlides: 2, maxSlides: 3 },
    { section: "Context & Problem", purpose: "Explain why this project exists", minSlides: 1, maxSlides: 3 },
    { section: "Solution Overview", purpose: "High-level what we're building", minSlides: 1, maxSlides: 2 },
    { section: "Requirements Deep Dive", purpose: "Key functional requirements", minSlides: 2, maxSlides: 4 },
    { section: "Architecture", purpose: "Technical design and components", minSlides: 1, maxSlides: 3 },
    { section: "Implementation Status", purpose: "Current progress and metrics", minSlides: 1, maxSlides: 2 },
    { section: "Risks & Challenges", purpose: "What could go wrong and mitigations", minSlides: 1, maxSlides: 2 },
    { section: "Next Steps", purpose: "Roadmap and call to action", minSlides: 1, maxSlides: 2 },
  ];

  // Distribute slides across sections
  const result: { section: string; slideCount: number; layouts: string[]; purpose: string }[] = [];
  let remainingSlides = targetSlides;
  const minTotal = sections.reduce((sum, s) => sum + s.minSlides, 0);
  
  // First pass: assign minimum slides
  for (const sec of sections) {
    const count = Math.min(sec.minSlides, remainingSlides);
    result.push({ section: sec.section, slideCount: count, layouts: [], purpose: sec.purpose });
    remainingSlides -= count;
  }

  // Second pass: distribute remaining slides proportionally
  while (remainingSlides > 0) {
    for (let i = 0; i < result.length && remainingSlides > 0; i++) {
      const maxForSection = sections[i].maxSlides;
      if (result[i].slideCount < maxForSection) {
        result[i].slideCount++;
        remainingSlides--;
      }
    }
    // Prevent infinite loop
    if (remainingSlides === targetSlides) break;
  }

  // Assign recommended layouts per section
  const layoutSuggestions: Record<string, string[]> = {
    "Opening": ["title-cover", "quote"],
    "Context & Problem": ["title-content", "image-right", "bullets"],
    "Solution Overview": ["image-left", "title-content", "stats-grid"],
    "Requirements Deep Dive": ["bullets", "two-column", "icon-grid", "comparison"],
    "Architecture": ["architecture", "image-left", "title-content"],
    "Implementation Status": ["stats-grid", "timeline", "bullets"],
    "Risks & Challenges": ["two-column", "bullets", "comparison"],
    "Next Steps": ["timeline", "bullets", "quote"],
  };

  for (const r of result) {
    r.layouts = layoutSuggestions[r.section] || ["title-content", "bullets"];
  }

  return result.filter(s => s.slideCount > 0);
}

// Generate slide outline (fast, low tokens) - ENFORCES EXACT SLIDE COUNT
async function generateSlideOutline(
  blackboard: BlackboardEntry[],
  targetSlides: number,
  collectedData: Record<string, any>,
  mode: string,
  apiKey: string,
  initialPrompt?: string
): Promise<SlideOutline[]> {
  const projectName = collectedData.settings?.name || "Project";
  const projectDesc = collectedData.settings?.description || "";
  
  const reqCount = collectedData.requirements?.length || 0;
  const nodeCount = collectedData.canvas?.nodes?.length || 0;
  const fileCount = collectedData.repoStructure?.files?.length || 0;
  
  // Build the story structure
  const storyStructure = buildStoryStructure(targetSlides, mode);
  
  // Build structured blackboard summary by category
  const narrativeEntries = blackboard.filter(e => e.category === "narrative").slice(0, 5);
  const insightEntries = blackboard.filter(e => e.category === "insight").slice(0, 10);
  const analysisEntries = blackboard.filter(e => e.category === "analysis").slice(0, 5);
  const estimateEntries = blackboard.filter(e => e.category === "estimate").slice(0, 3);
  
  const blackboardSummary = `
NARRATIVE HOOKS:
${narrativeEntries.map(e => `- ${e.content}`).join("\n") || "- No narratives collected"}

KEY INSIGHTS:
${insightEntries.map(e => `- ${e.content}`).join("\n") || "- No insights collected"}

ANALYSIS:
${analysisEntries.map(e => `- ${e.content}`).join("\n") || "- No analysis collected"}

STATUS ESTIMATES:
${estimateEntries.map(e => `- ${e.content}`).join("\n") || "- No estimates"}`;

  // Build the section breakdown instruction
  const sectionInstructions = storyStructure.map((s, idx) => {
    const startSlide = storyStructure.slice(0, idx).reduce((sum, x) => sum + x.slideCount, 0) + 1;
    const endSlide = startSlide + s.slideCount - 1;
    const slideRange = startSlide === endSlide ? `Slide ${startSlide}` : `Slides ${startSlide}-${endSlide}`;
    return `${slideRange}: "${s.section}" (${s.slideCount} slides) - ${s.purpose}. Use layouts: ${s.layouts.join(", ")}`;
  }).join("\n");

  const outlinePrompt = `You are creating a ${mode} presentation about "${projectName}" with EXACTLY ${targetSlides} slides.

PROJECT: ${projectName}
DESCRIPTION: ${projectDesc}
STATS: ${reqCount} requirements, ${nodeCount} architecture components, ${fileCount} code files
${initialPrompt ? `\nUSER FOCUS: ${initialPrompt}` : ""}

BLACKBOARD (collected insights from project data):
${blackboardSummary}

REQUIRED SLIDE STRUCTURE (YOU MUST FOLLOW THIS EXACTLY):
${sectionInstructions}

CRITICAL RULES:
1. Generate EXACTLY ${targetSlides} slides, numbered 1 to ${targetSlides}
2. Follow the section breakdown above precisely
3. Each slide must have: order, layoutId, title, purpose, keyContent (2-4 points)
4. For image layouts (image-left, image-right, architecture), include imagePrompt
5. Use data from the blackboard to make each slide specific and compelling
6. Titles should be action-oriented and specific, not generic
7. The slides must tell a COHESIVE STORY from start to finish

AVAILABLE LAYOUTS: title-cover, section-divider, title-content, two-column, image-left, image-right, stats-grid, bullets, quote, architecture, comparison, timeline, icon-grid

Return a JSON array with EXACTLY ${targetSlides} slide outlines. NO MARKDOWN, ONLY JSON.`;

  console.log(`Generating slide outline for ${targetSlides} slides with Gemini...`);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `You are a presentation structure expert. You MUST return EXACTLY ${targetSlides} slides in a JSON array. Do not return more or fewer slides. Each slide tells part of a cohesive story.` }],
        },
        contents: [{ role: "user", parts: [{ text: outlinePrompt }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Outline generation failed:", response.status, errorText);
    throw new Error(`Outline generation failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed = parseAgentResponseText(text);

  if (!Array.isArray(parsed)) {
    console.error("Outline is not an array:", parsed);
    throw new Error("Invalid outline format");
  }

  // ENFORCE EXACT SLIDE COUNT
  if (parsed.length < targetSlides) {
    console.warn(`LLM returned ${parsed.length} slides, need ${targetSlides}. Padding...`);
    // Pad with additional slides
    const existingTitles = new Set(parsed.map((s: SlideOutline) => s.title));
    const paddingLayouts = ["bullets", "title-content", "image-right", "stats-grid"];
    const paddingTopics = [
      { title: "Additional Insights", purpose: "Further observations from the project data", keyContent: ["Project insights", "Key observations"] },
      { title: "Technical Details", purpose: "More technical context", keyContent: ["Implementation details", "Technical considerations"] },
      { title: "Stakeholder Benefits", purpose: "Value proposition for stakeholders", keyContent: ["Business value", "User benefits"] },
      { title: "Quality Assurance", purpose: "Testing and validation approach", keyContent: ["Testing strategy", "Quality metrics"] },
      { title: "Team & Resources", purpose: "Team composition and resources", keyContent: ["Team structure", "Resource allocation"] },
      { title: "Future Vision", purpose: "Long-term vision and goals", keyContent: ["Long-term goals", "Future enhancements"] },
    ];
    
    while (parsed.length < targetSlides) {
      const idx = parsed.length;
      const paddingIdx = idx % paddingTopics.length;
      let topic = paddingTopics[paddingIdx];
      // Avoid duplicate titles
      if (existingTitles.has(topic.title)) {
        topic = { ...topic, title: `${topic.title} (${idx})` };
      }
      existingTitles.add(topic.title);
      
      parsed.push({
        order: idx + 1,
        layoutId: paddingLayouts[idx % paddingLayouts.length],
        title: topic.title,
        purpose: topic.purpose,
        keyContent: topic.keyContent,
      });
    }
  } else if (parsed.length > targetSlides) {
    console.warn(`LLM returned ${parsed.length} slides, truncating to ${targetSlides}`);
    parsed = parsed.slice(0, targetSlides);
  }

  // Ensure order is correct
  parsed = parsed.map((s: SlideOutline, i: number) => ({ ...s, order: i + 1 }));

  console.log(`✅ Generated outline with exactly ${parsed.length} slides`);
  return parsed as SlideOutline[];
}

// Generate a single slide from outline with full context
async function generateSingleSlide(
  outline: SlideOutline,
  blackboard: BlackboardEntry[],
  collectedData: Record<string, any>,
  allOutlines: SlideOutline[],
  apiKey: string
): Promise<GeneratedSlide> {
  const contextData = getRelevantDataForSlide(outline, blackboard, collectedData);
  const projectName = collectedData.settings?.name || "Project";
  const projectDesc = collectedData.settings?.description || "";

  // Build story context - where is this slide in the narrative?
  const prevSlides = allOutlines.slice(0, outline.order - 1);
  const nextSlides = allOutlines.slice(outline.order);
  const storyPosition = outline.order === 1 ? "opening" : 
    outline.order === allOutlines.length ? "closing" : 
    outline.order <= 3 ? "introduction" : 
    outline.order >= allOutlines.length - 2 ? "conclusion" : "body";

  // Get related blackboard entries for this specific slide
  const relatedInsights = blackboard
    .filter(e => {
      const content = e.content.toLowerCase();
      return outline.keyContent.some(kc => content.includes(kc.toLowerCase())) ||
             content.includes(outline.title.toLowerCase()) ||
             content.includes(outline.purpose.toLowerCase());
    })
    .slice(0, 5)
    .map(e => `[${e.category}] ${e.content}`)
    .join("\n");

  const slidePrompt = `Generate slide ${outline.order}/${allOutlines.length} for "${projectName}".

PROJECT CONTEXT:
- Name: ${projectName}
- Description: ${projectDesc}
- This is the ${storyPosition} of the presentation

SLIDE TO GENERATE:
- Order: ${outline.order}
- Title: "${outline.title}"
- Layout: ${outline.layoutId}
- Purpose: ${outline.purpose}
- Key points to cover: ${outline.keyContent.join("; ")}
${outline.imagePrompt ? `- Image to generate: ${outline.imagePrompt}` : ""}

STORY FLOW:
${prevSlides.length > 0 ? `Previous slides: ${prevSlides.map(o => `${o.order}. ${o.title}`).join(" → ")}` : "This is the first slide."}
${nextSlides.length > 0 ? `\nNext slides: ${nextSlides.slice(0, 3).map(o => `${o.order}. ${o.title}`).join(" → ")}` : "This is the final slide."}

RELATED PROJECT DATA:
${relatedInsights || "Use the key points to create compelling content."}

${contextData}

LAYOUT REGIONS FOR "${outline.layoutId}":
${getLayoutRegions(outline.layoutId)}

CONTENT GENERATION RULES:
1. Create content that flows naturally from the previous slide and leads into the next
2. Be SPECIFIC - use actual data, names, numbers from the project
3. For bullets: use { items: [{ title: "...", description: "..." }, ...] }
4. For stats: use { value: "number", label: "metric name" }
5. For timeline: use { steps: [{ title: "...", description: "..." }, ...] }
6. For icon-grid: use { items: [{ icon: "emoji", title: "...", description: "..." }, ...] }
7. Use **bold** for emphasis, *italic* for terms
8. NEVER use HTML tags (<b>, <p>, <ul>, <li>, etc.)
9. Speaker notes should explain what to emphasize verbally

Return a single JSON object:
{
  "id": "${generateId()}",
  "order": ${outline.order},
  "layoutId": "${outline.layoutId}",
  "title": "${outline.title}",
  "content": [
    { "regionId": "...", "type": "...", "data": {...} }
  ],
  "notes": "2-3 sentence speaker notes"${outline.imagePrompt ? `,
  "imagePrompt": "${outline.imagePrompt}"` : ""}
}

ONLY RETURN THE JSON OBJECT, NO EXPLANATION.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `You generate professional presentation slides as JSON. Each slide must be specific to the project data provided, not generic. Return only valid JSON objects, no markdown fences.` }],
        },
        contents: [{ role: "user", parts: [{ text: slidePrompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Slide ${outline.order} generation failed:`, response.status, errorText);
    throw new Error(`Slide generation failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseAgentResponseText(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid slide format");
  }

  // Ensure required fields
  const slide: GeneratedSlide = {
    id: parsed.id || generateId(),
    order: outline.order,
    layoutId: outline.layoutId,
    title: parsed.title || outline.title,
    content: Array.isArray(parsed.content) ? parsed.content : [],
    notes: parsed.notes || outline.purpose,
    imagePrompt: outline.imagePrompt || parsed.imagePrompt,
  };

  if (parsed.subtitle) slide.subtitle = parsed.subtitle;

  return slide;
}

// Create fallback slide from outline
function createFallbackSlide(outline: SlideOutline): GeneratedSlide {
  return {
    id: generateId(),
    order: outline.order,
    layoutId: outline.layoutId,
    title: outline.title,
    content: [{
      regionId: "content",
      type: "richtext",
      data: { text: outline.keyContent.map(kc => `**${kc}**`).join("\n\n") }
    }],
    notes: outline.purpose,
    imagePrompt: outline.imagePrompt,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const authHeader = req.headers.get("authorization");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: authHeader ? { Authorization: authHeader } : {},
          },
        });

        const requestData: PresentationRequest = await req.json();
        const { projectId, presentationId, shareToken, mode, targetSlides, initialPrompt } = requestData;

        console.log("Starting presentation generation:", { projectId, presentationId, mode, targetSlides });

        controller.enqueue(encoder.encode(sseMessage("status", { phase: "starting", message: "Initializing presentation agent..." })));

        // Update presentation status
        await supabase.rpc("update_presentation_with_token", {
          p_presentation_id: presentationId,
          p_token: shareToken,
          p_status: "generating",
        });

        if (!geminiKey) {
          throw new Error("GEMINI_API_KEY is not configured");
        }

        const blackboard: BlackboardEntry[] = [];
        const collectedData: Record<string, any> = {};

        // Helper to add blackboard entry and stream it
        const addToBlackboard = async (entry: Omit<BlackboardEntry, "id" | "timestamp">) => {
          const fullEntry: BlackboardEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            ...entry,
          };
          blackboard.push(fullEntry);
          controller.enqueue(encoder.encode(sseMessage("blackboard", fullEntry)));

          await supabase.rpc("append_presentation_blackboard_with_token", {
            p_presentation_id: presentationId,
            p_token: shareToken,
            p_entry: fullEntry,
          });

          return fullEntry;
        };

        // ============ DEEP DATA COLLECTION TOOLS ============

        // Tool: Read Settings with deep analysis
        const readSettings = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_settings", message: "Analyzing project settings..." })));

          try {
            const { data: proj, error } = await supabase.rpc("get_project_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.settings = proj;
            const entries: BlackboardEntry[] = [];

            // Deep observation
            entries.push(await addToBlackboard({
              source: "read_settings",
              category: "observation",
              content: `Project "${proj.name}" established on ${new Date(proj.created_at).toLocaleDateString()}. ${proj.description ? `Core purpose: ${proj.description}` : "No description provided - this may indicate early-stage planning."}`,
              data: { name: proj.name, description: proj.description, created: proj.created_at },
            }));

            if (proj.organization) {
              entries.push(await addToBlackboard({
                source: "read_settings",
                category: "observation",
                content: `Organizational context: ${proj.organization}. This provides institutional framing for stakeholder communications.`,
                data: { organization: proj.organization },
              }));
            }

            // Derive insights
            const ageInDays = Math.floor((Date.now() - new Date(proj.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const maturityAssessment = ageInDays < 7 ? "nascent" : ageInDays < 30 ? "developing" : ageInDays < 90 ? "maturing" : "established";

            entries.push(await addToBlackboard({
              source: "read_settings",
              category: "insight",
              content: `Project age: ${ageInDays} days (${maturityAssessment} phase). ${maturityAssessment === "nascent" ? "Expect foundational elements still forming." : maturityAssessment === "established" ? "Should have substantial documentation and implementation." : "Active development likely ongoing."}`,
              data: { ageInDays, maturityAssessment },
            }));

            entries.push(await addToBlackboard({
              source: "read_settings",
              category: "narrative",
              content: `Opening narrative hook: "${proj.name}" ${proj.description ? `aims to ${proj.description.toLowerCase().replace(/^\w/, (c: string) => c.toLowerCase())}` : "represents a strategic initiative requiring further definition"}.`,
            }));

            return { tool: "read_settings", success: true, data: proj, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_settings", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Requirements with deep analysis
        const readRequirements = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_requirements", message: "Analyzing requirements in depth..." })));

          try {
            const { data: requirements, error } = await supabase.rpc("get_requirements_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.requirements = requirements || [];
            const entries: BlackboardEntry[] = [];
            const reqs = requirements || [];

            entries.push(await addToBlackboard({
              source: "read_requirements",
              category: "observation",
              content: `Requirements corpus contains ${reqs.length} items. ${reqs.length === 0 ? "No formal requirements documented - presentation will need to focus on vision and roadmap." : `Comprehensive requirements provide solid foundation for detailed analysis.`}`,
              data: { count: reqs.length },
            }));

            if (reqs.length > 0) {
              const topLevel = reqs.filter((r: any) => !r.parent_id);
              const nested = reqs.filter((r: any) => r.parent_id);
              const decompositionRatio = nested.length / Math.max(topLevel.length, 1);

              entries.push(await addToBlackboard({
                source: "read_requirements",
                category: "analysis",
                content: `Requirements structure analysis: ${topLevel.length} top-level requirements with ${nested.length} child items. Decomposition ratio: ${decompositionRatio.toFixed(1)}x. ${decompositionRatio > 3 ? "Well-decomposed requirements indicate mature planning." : decompositionRatio > 1 ? "Moderate decomposition suggests ongoing refinement." : "Flat structure may benefit from further breakdown."}`,
                data: { topLevel: topLevel.length, nested: nested.length, decompositionRatio },
              }));

              // Extract key requirements for narrative
              const keyReqs = topLevel.slice(0, 6).map((r: { code?: string; title?: string; content?: string }) => ({
                code: r.code,
                title: r.title,
                content: (r.content || "").slice(0, 200),
              }));

              entries.push(await addToBlackboard({
                source: "read_requirements",
                category: "narrative",
                content: `Key requirements to highlight: ${keyReqs.map((r: any) => `${r.code}: ${r.title}`).join("; ")}. These form the core value proposition.`,
                data: { keyRequirements: keyReqs },
              }));

              // Add insight for each key requirement
              for (const req of keyReqs.slice(0, 5)) {
                entries.push(await addToBlackboard({
                  source: "read_requirements",
                  category: "insight",
                  content: `${req.code}: ${req.content || req.title}`,
                  data: { requirementId: req.code, title: req.title },
                }));
              }
            }

            return { tool: "read_requirements", success: true, data: requirements, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_requirements", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Artifacts
        const readArtifacts = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_artifacts", message: "Scanning project artifacts..." })));

          try {
            const { data: artifacts, error } = await supabase.rpc("get_artifacts_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.artifacts = artifacts || [];
            const entries: BlackboardEntry[] = [];
            const arts = artifacts || [];

            entries.push(await addToBlackboard({
              source: "read_artifacts",
              category: "observation",
              content: `Documentation inventory: ${arts.length} artifacts. ${arts.length === 0 ? "No artifacts uploaded yet." : "Rich documentation provides narrative material."}`,
              data: { count: arts.length },
            }));

            if (arts.length > 0) {
              const withImages = arts.filter((a: any) => a.image_url).length;
              const withSummaries = arts.filter((a: any) => a.ai_summary).length;
              const titled = arts.filter((a: any) => a.ai_title).length;

              entries.push(await addToBlackboard({
                source: "read_artifacts",
                category: "observation",
                content: `Artifact composition: ${withImages} include images (visual assets for slides), ${withSummaries} have AI summaries (pre-analyzed content), ${titled} have titles.`,
                data: { images: withImages, summaries: withSummaries, titled },
              }));

              // Extract key artifacts for slide content
              for (const art of arts.slice(0, 3)) {
                if (art.ai_summary) {
                  entries.push(await addToBlackboard({
                    source: "read_artifacts",
                    category: "insight",
                    content: `${art.ai_title || "Untitled artifact"}: ${art.ai_summary}`,
                    data: { artifactId: art.id, title: art.ai_title },
                  }));
                } else if (art.content) {
                  entries.push(await addToBlackboard({
                    source: "read_artifacts",
                    category: "observation",
                    content: `${art.ai_title || "Untitled artifact"}: ${art.content.slice(0, 300)}...`,
                    data: { artifactId: art.id },
                  }));
                }
              }
            }

            return { tool: "read_artifacts", success: true, data: artifacts, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_artifacts", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Specifications
        const readSpecifications = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_specifications", message: "Reviewing generated specifications..." })));

          try {
            const { data: specs, error } = await supabase.rpc("get_specifications_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.specifications = specs || [];
            const entries: BlackboardEntry[] = [];

            entries.push(await addToBlackboard({
              source: "read_specifications",
              category: "observation",
              content: `${(specs || []).length} generated specification(s) available. ${(specs || []).length === 0 ? "No formal specs generated yet." : "Formal specifications available for reference."}`,
              data: { count: (specs || []).length },
            }));

            return { tool: "read_specifications", success: true, data: specs, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_specifications", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Canvas with architecture analysis
        const readCanvas = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_canvas", message: "Analyzing architecture canvas..." })));

          try {
            const { data: nodes, error: nodesError } = await supabase.rpc("get_canvas_nodes_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            const { data: edges, error: edgesError } = await supabase.rpc("get_canvas_edges_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (nodesError) throw nodesError;
            collectedData.canvas = { nodes: nodes || [], edges: edges || [] };
            const entries: BlackboardEntry[] = [];

            const nodeList = nodes || [];
            const edgeList = edges || [];

            entries.push(await addToBlackboard({
              source: "read_canvas",
              category: "observation",
              content: `Architecture canvas contains ${nodeList.length} components and ${edgeList.length} connections. ${nodeList.length === 0 ? "No architecture defined yet." : "Visual architecture available for presentation."}`,
              data: { nodes: nodeList.length, edges: edgeList.length },
            }));

            if (nodeList.length > 0) {
              // Analyze node types
              const nodeTypes: Record<string, number> = {};
              nodeList.forEach((n: any) => {
                nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
              });

              entries.push(await addToBlackboard({
                source: "read_canvas",
                category: "analysis",
                content: `Architecture composition: ${Object.entries(nodeTypes).map(([t, c]) => `${c} ${t}`).join(", ")}. This reveals the system's structural paradigm.`,
                data: { nodeTypes },
              }));

              // Connectivity analysis
              const connectivity = edgeList.length / Math.max(nodeList.length, 1);
              entries.push(await addToBlackboard({
                source: "read_canvas",
                category: "insight",
                content: `Connectivity analysis: ${connectivity.toFixed(2)} connections per component. ${connectivity > 2 ? "Highly interconnected system." : connectivity > 1 ? "Moderate coupling indicates balanced architecture." : "Loosely coupled components suggest microservices or modular design."}`,
                data: { connectivity },
              }));

              // Extract key components for slides
              const keyComponents = nodeList.slice(0, 10).map((n: any) => ({
                type: n.type,
                label: n.data?.label || n.data?.title || "Unnamed",
                description: n.data?.description || "",
              }));

              entries.push(await addToBlackboard({
                source: "read_canvas",
                category: "narrative",
                content: `Key architectural components: ${keyComponents.map((c: any) => `${c.label} (${c.type})`).join(", ")}. These form the system's backbone.`,
                data: { components: keyComponents },
              }));
            }

            return { tool: "read_canvas", success: true, data: collectedData.canvas, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_canvas", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Repo Structure
        const readRepoStructure = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_repo", message: "Scanning code repositories..." })));

          try {
            const { data: repos, error: reposError } = await supabase.rpc("get_repos_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (reposError) throw reposError;

            const allFiles: any[] = [];
            for (const repo of repos || []) {
              const { data: files } = await supabase.rpc("get_repo_files_with_token", {
                p_repo_id: repo.id,
                p_token: shareToken,
              });
              if (files) allFiles.push(...files);
            }

            collectedData.repoStructure = { repos: repos || [], files: allFiles };
            const entries: BlackboardEntry[] = [];

            entries.push(await addToBlackboard({
              source: "read_repo_structure",
              category: "observation",
              content: `Codebase inventory: ${(repos || []).length} repositories containing ${allFiles.length} files. ${allFiles.length === 0 ? "No code files yet - project is in planning phase." : "Active development with trackable progress."}`,
              data: { repoCount: (repos || []).length, fileCount: allFiles.length },
            }));

            if (allFiles.length > 0) {
              // Analyze file types
              const extensions: Record<string, number> = {};
              const directories = new Set<string>();
              allFiles.forEach((f: any) => {
                const ext = f.path?.split(".").pop() || "unknown";
                extensions[ext] = (extensions[ext] || 0) + 1;
                const dir = f.path?.split("/").slice(0, -1).join("/");
                if (dir) directories.add(dir);
              });

              entries.push(await addToBlackboard({
                source: "read_repo_structure",
                category: "analysis",
                content: `Code organization: ${directories.size} directories. Primary languages/formats: ${Object.entries(extensions).slice(0, 5).map(([e, c]) => `${e} (${c} files)`).join(", ")}. This indicates technology choices and project scope.`,
                data: { extensions, directories: directories.size },
              }));
            }

            return { tool: "read_repo_structure", success: true, data: collectedData.repoStructure, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_repo_structure", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Databases
        const readDatabases = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_databases", message: "Checking database configurations..." })));

          try {
            const { data: databases, error } = await supabase.rpc("get_databases_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.databases = databases || [];
            const entries: BlackboardEntry[] = [];

            entries.push(await addToBlackboard({
              source: "read_databases",
              category: "observation",
              content: `Database infrastructure: ${(databases || []).length} database(s) configured. ${(databases || []).length === 0 ? "No databases configured yet." : "Data layer established."}`,
              data: { count: (databases || []).length },
            }));

            return { tool: "read_databases", success: true, data: databases, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_databases", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Connections
        const readConnections = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_connections", message: "Reviewing external connections..." })));

          try {
            const { data: connections, error } = await supabase.rpc("get_database_connections_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.connections = connections || [];
            const entries: BlackboardEntry[] = [];

            entries.push(await addToBlackboard({
              source: "read_connections",
              category: "observation",
              content: `External integrations: ${(connections || []).length} connection(s). ${(connections || []).length === 0 ? "No external data sources connected." : "Integration points established."}`,
              data: { count: (connections || []).length },
            }));

            return { tool: "read_connections", success: true, data: connections, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_connections", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // Tool: Read Deployments
        const readDeployments = async (): Promise<ToolResult> => {
          controller.enqueue(encoder.encode(sseMessage("status", { phase: "read_deployments", message: "Checking deployment status..." })));

          try {
            const { data: deployments, error } = await supabase.rpc("get_deployments_with_token", {
              p_project_id: projectId,
              p_token: shareToken,
            });

            if (error) throw error;
            collectedData.deployments = deployments || [];
            const entries: BlackboardEntry[] = [];
            const deps = deployments || [];

            entries.push(await addToBlackboard({
              source: "read_deployments",
              category: "observation",
              content: `Deployment configurations: ${deps.length}. ${deps.length === 0 ? "No deployments configured - project not yet production-ready." : "Deployment pipeline established."}`,
              data: { count: deps.length },
            }));

            if (deps.length > 0) {
              const live = deps.filter((d: any) => d.status === "deployed" || d.status === "live" || d.status === "running");
              entries.push(await addToBlackboard({
                source: "read_deployments",
                category: "insight",
                content: `${live.length}/${deps.length} deployments are live. ${live.length > 0 ? "Production presence established." : "Deployments configured but not yet live."}`,
                data: { liveCount: live.length },
              }));
            }

            return { tool: "read_deployments", success: true, data: deployments, blackboardEntries: entries };
          } catch (error: any) {
            return { tool: "read_deployments", success: false, error: error.message, blackboardEntries: [] };
          }
        };

        // ============ EXECUTE DATA COLLECTION ============
        const toolResults: ToolResult[] = [];

        toolResults.push(await readSettings());
        toolResults.push(await readRequirements());
        toolResults.push(await readArtifacts());
        toolResults.push(await readSpecifications());
        toolResults.push(await readCanvas());
        toolResults.push(await readRepoStructure());
        toolResults.push(await readDatabases());
        toolResults.push(await readConnections());
        toolResults.push(await readDeployments());

        // ============ SYNTHESIS PHASE ============
        controller.enqueue(encoder.encode(sseMessage("status", { phase: "synthesis", message: "Synthesizing insights..." })));

        const reqCount = collectedData.requirements?.length || 0;
        const nodeCount = collectedData.canvas?.nodes?.length || 0;
        const fileCount = collectedData.repoStructure?.files?.length || 0;
        const specCount = collectedData.specifications?.length || 0;
        const artifactCount = collectedData.artifacts?.length || 0;
        const dbCount = collectedData.databases?.length || 0;
        const deployCount = collectedData.deployments?.length || 0;

        const completionScore = Math.min(100, Math.round(
          (reqCount > 0 ? 15 : 0) +
          (nodeCount > 0 ? 20 : 0) +
          (fileCount > 0 ? 25 : 0) +
          (specCount > 0 ? 15 : 0) +
          (artifactCount > 0 ? 10 : 0) +
          (dbCount > 0 ? 8 : 0) +
          (deployCount > 0 ? 7 : 0)
        ));

        await addToBlackboard({
          source: "synthesis",
          category: "estimate",
          content: `Project maturity assessment: ${completionScore}% complete. ${completionScore < 30 ? "Early stage - focus on vision and roadmap." : completionScore < 60 ? "Mid-development - balance current state with future plans." : "Advanced - emphasize achievements and remaining work."}`,
          data: {
            completionScore,
            breakdown: { requirements: reqCount, architecture: nodeCount, code: fileCount, specs: specCount, artifacts: artifactCount, databases: dbCount, deployments: deployCount },
          },
        });

        const projectName = collectedData.settings?.name || "Project";
        await addToBlackboard({
          source: "synthesis",
          category: "narrative",
          content: `Executive Summary (BLUF): ${projectName}. Current status: ${completionScore}% complete with ${reqCount} requirements defined, ${nodeCount} architectural components designed, and ${fileCount} code files implemented.`,
          data: { type: "bluf" },
        });

        // ============ CHECKPOINT: Save blackboard before slide generation ============
        await supabase.rpc("update_presentation_with_token", {
          p_presentation_id: presentationId,
          p_token: shareToken,
          p_blackboard: blackboard,
          p_status: "generating_slides",
        });

        // ============ INCREMENTAL SLIDE GENERATION ============
        controller.enqueue(encoder.encode(sseMessage("status", { 
          phase: "planning", 
          message: "Planning slide structure..." 
        })));

        let slideOutline: SlideOutline[];
        try {
          slideOutline = await generateSlideOutline(
            blackboard,
            targetSlides,
            collectedData,
            mode,
            geminiKey,
            initialPrompt
          );
        } catch (outlineError: any) {
          console.error("Outline generation failed:", outlineError);
          // Create basic outline fallback
          slideOutline = [
            { order: 1, layoutId: "title-cover", title: projectName, purpose: "Cover slide", keyContent: [projectName] },
            { order: 2, layoutId: "quote", title: "Executive Summary", purpose: "Key takeaways", keyContent: [`${completionScore}% complete`, `${reqCount} requirements`] },
            { order: 3, layoutId: "stats-grid", title: "Project Status", purpose: "Current metrics", keyContent: ["Requirements", "Architecture", "Code", "Progress"] },
            { order: 4, layoutId: "bullets", title: "Key Insights", purpose: "Highlights from analysis", keyContent: blackboard.filter(e => e.category === "insight").slice(0, 4).map(e => e.content.slice(0, 50)) },
          ];
        }

        controller.enqueue(encoder.encode(sseMessage("status", { 
          phase: "generating_slides", 
          message: `Generating ${slideOutline.length} slides...`,
          total: slideOutline.length,
          current: 0
        })));

        // Generate each slide individually
        const slidesJson: GeneratedSlide[] = [];

        for (let i = 0; i < slideOutline.length; i++) {
          const outline = slideOutline[i];

          controller.enqueue(encoder.encode(sseMessage("status", { 
            phase: "generating_slides", 
            message: `Generating slide ${i + 1}/${slideOutline.length}: "${outline.title}"`,
            current: i + 1,
            total: slideOutline.length
          })));

          try {
            const fullSlide = await generateSingleSlide(
              outline,
              blackboard,
              collectedData,
              slideOutline,
              geminiKey
            );

            slidesJson.push(fullSlide);

            // Stream the slide to client immediately
            controller.enqueue(encoder.encode(sseMessage("slide", fullSlide)));

            // Checkpoint save every 3 slides
            if ((i + 1) % 3 === 0 || i === slideOutline.length - 1) {
              await supabase.rpc("update_presentation_with_token", {
                p_presentation_id: presentationId,
                p_token: shareToken,
                p_slides: slidesJson,
                p_status: "generating",
              });
            }

          } catch (slideError: any) {
            console.error(`Failed to generate slide ${i + 1}:`, slideError);

            // Create fallback slide from outline
            const fallbackSlide = createFallbackSlide(outline);
            slidesJson.push(fallbackSlide);
            controller.enqueue(encoder.encode(sseMessage("slide", fallbackSlide)));
          }
        }

        console.log(`✅ Generated ${slidesJson.length} slides incrementally`);

        // ============ IMAGE GENERATION PHASE ============
        const slidesNeedingImages = slidesJson.filter(
          (s: any) => s.imagePrompt && !s.imageUrl
        );

        if (slidesNeedingImages.length > 0) {
          controller.enqueue(encoder.encode(sseMessage("status", { 
            phase: "generating_images", 
            message: `Generating images for ${Math.min(slidesNeedingImages.length, 5)} slides...` 
          })));

          let imagesGenerated = 0;
          const maxImages = Math.min(slidesNeedingImages.length, 5);

          for (let i = 0; i < maxImages; i++) {
            const slide = slidesNeedingImages[i];

            controller.enqueue(encoder.encode(sseMessage("status", { 
              phase: "generating_images", 
              message: `Generating image ${i + 1}/${maxImages}: "${slide.title}"...` 
            })));

            const imageUrl = await generateSlideImage(
              slide.imagePrompt!,
              supabaseUrl,
              supabaseKey
            );

            if (imageUrl) {
              const slideIndex = slidesJson.findIndex((s: any) => s.id === slide.id);
              if (slideIndex !== -1) {
                slidesJson[slideIndex].imageUrl = imageUrl;

                // Add to content array for image region
                const imageLayouts: Record<string, string> = {
                  "image-left": "image",
                  "image-right": "image",
                  "architecture": "diagram",
                  "title-cover": "background",
                };

                const imageRegion = imageLayouts[slide.layoutId];
                if (imageRegion) {
                  const hasImageContent = slidesJson[slideIndex].content?.some(
                    (c: any) => c.regionId === imageRegion && c.type === "image"
                  );

                  if (!hasImageContent) {
                    slidesJson[slideIndex].content = slidesJson[slideIndex].content || [];
                    slidesJson[slideIndex].content.push({
                      regionId: imageRegion,
                      type: "image",
                      data: { url: imageUrl, alt: slide.imagePrompt }
                    });
                  }
                }
              }
              imagesGenerated++;
            }
          }

          await addToBlackboard({
            source: "image_generation",
            category: "observation",
            content: `Generated ${imagesGenerated} images for ${slidesNeedingImages.length} image-capable slides.`,
            data: { generated: imagesGenerated, requested: slidesNeedingImages.length }
          });
        }

        // ============ SAVE FINAL PRESENTATION ============
        controller.enqueue(encoder.encode(sseMessage("status", { phase: "saving", message: "Saving presentation..." })));

        const metadata = {
          generatedAt: new Date().toISOString(),
          model: "gemini-2.5-flash",
          mode,
          targetSlides,
          actualSlides: slidesJson.length,
          blackboardEntries: blackboard.length,
          dataStats: {
            requirements: reqCount,
            artifacts: artifactCount,
            canvasNodes: nodeCount,
            specifications: specCount,
            codeFiles: fileCount,
            databases: dbCount,
            deployments: deployCount,
          },
          completionEstimate: completionScore,
        };

        await supabase.rpc("update_presentation_with_token", {
          p_presentation_id: presentationId,
          p_token: shareToken,
          p_slides: slidesJson,
          p_blackboard: blackboard,
          p_metadata: metadata,
          p_status: "completed",
        });

        controller.enqueue(encoder.encode(sseMessage("complete", {
          presentationId,
          slideCount: slidesJson.length,
          blackboardCount: blackboard.length,
          model: "gemini-2.5-flash",
        })));

        controller.close();
      } catch (error: any) {
        console.error("Presentation agent error:", error);
        controller.enqueue(encoder.encode(sseMessage("error", { message: error.message })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
