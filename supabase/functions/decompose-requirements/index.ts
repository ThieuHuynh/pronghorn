import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    const { text, projectId, shareToken, attachedContext } = body;
    
    // Check if we have either text or attachedContext with content
    const hasAttachedContext = attachedContext && (
      attachedContext.projectMetadata ||
      attachedContext.artifacts?.length ||
      attachedContext.requirements?.length ||
      attachedContext.standards?.length ||
      attachedContext.techStacks?.length ||
      attachedContext.canvasNodes?.length ||
      attachedContext.chatSessions?.length ||
      attachedContext.files?.length
    );
    
    if (!projectId) {
      console.error("Missing projectId");
      throw new Error("Missing required parameter: projectId");
    }
    
    if (!text && !hasAttachedContext) {
      console.error("Missing both text and attachedContext");
      throw new Error("Please provide either text to decompose or project context");
    }

    // Validate projectId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      console.error("Invalid projectId format:", projectId);
      throw new Error(`Invalid projectId format. Received: ${projectId}. Expected a valid UUID.`);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client to store the requirements
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get auth header for authenticated users
    const authHeader = req.headers.get('Authorization');
    
    // Create client with anon key (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Set share token if provided (for anonymous users)
    if (shareToken) {
      const { error: tokenError } = await supabase.rpc('set_share_token', { token: shareToken });
      if (tokenError) {
        console.error('Error setting share token:', tokenError);
        throw new Error('Invalid share token');
      }
    }

    console.log("Decomposing requirements for project:", projectId);
    console.log("Input text length:", text.length);

    // Build context string from attached context
    let contextString = '';
    
    if (attachedContext) {
      if (attachedContext.projectMetadata) {
        const pm = attachedContext.projectMetadata;
        contextString += `PROJECT METADATA:\n`;
        contextString += `- Name: ${pm.name || 'N/A'}\n`;
        contextString += `- Description: ${pm.description || 'N/A'}\n`;
        contextString += `- Status: ${pm.status || 'N/A'}\n`;
        contextString += `- Priority: ${pm.priority || 'N/A'}\n`;
        contextString += `- Scope: ${pm.scope || 'N/A'}\n\n`;
      }
      
      if (attachedContext.requirements?.length > 0) {
        contextString += `EXISTING REQUIREMENTS (${attachedContext.requirements.length}):\n`;
        attachedContext.requirements.forEach((r: any) => {
          contextString += `- [${r.type || 'REQ'}] ${r.code || ''} ${r.title}\n`;
          if (r.content) contextString += `  ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}\n`;
        });
        contextString += '\n';
      }
      
      if (attachedContext.standards?.length > 0) {
        contextString += `LINKED STANDARDS (${attachedContext.standards.length}):\n`;
        attachedContext.standards.forEach((s: any) => {
          contextString += `- ${s.code || ''} ${s.title}: ${s.description || ''}\n`;
        });
        contextString += '\n';
      }
      
      if (attachedContext.techStacks?.length > 0) {
        contextString += `TECH STACKS (${attachedContext.techStacks.length}):\n`;
        attachedContext.techStacks.forEach((t: any) => {
          contextString += `- ${t.name}${t.type ? ` (${t.type})` : ''}: ${t.description || ''}\n`;
        });
        contextString += '\n';
      }
      
      if (attachedContext.artifacts?.length > 0) {
        contextString += `ARTIFACTS (${attachedContext.artifacts.length}):\n`;
        attachedContext.artifacts.forEach((a: any) => {
          contextString += `--- ${a.ai_title || a.title || 'Artifact'} ---\n`;
          contextString += `${a.content?.substring(0, 500)}${a.content?.length > 500 ? '...' : ''}\n\n`;
        });
      }
      
      if (attachedContext.canvasNodes?.length > 0) {
        contextString += `CANVAS ARCHITECTURE (${attachedContext.canvasNodes.length} nodes):\n`;
        attachedContext.canvasNodes.forEach((n: any) => {
          const data = n.data || {};
          contextString += `- [${n.type}] ${data.label || data.title || 'Node'}\n`;
          if (data.description) contextString += `  ${data.description.substring(0, 100)}...\n`;
        });
        contextString += '\n';
      }
      
      if (attachedContext.chatSessions?.length > 0) {
        contextString += `CHAT SESSIONS (${attachedContext.chatSessions.length}):\n`;
        attachedContext.chatSessions.forEach((c: any) => {
          contextString += `- ${c.ai_title || c.title || 'Chat'}\n`;
          if (c.ai_summary) contextString += `  Summary: ${c.ai_summary.substring(0, 200)}...\n`;
        });
        contextString += '\n';
      }
      
      if (attachedContext.files?.length > 0) {
        contextString += `REPOSITORY FILES (${attachedContext.files.length}):\n`;
        attachedContext.files.forEach((f: any) => {
          contextString += `--- ${f.path} ---\n`;
          contextString += `${f.content?.substring(0, 300)}${f.content?.length > 300 ? '...' : ''}\n\n`;
        });
      }
    }

    console.log("Context string length:", contextString.length);

    // Build user message with optional context
    const userMessage = contextString 
      ? `Use this project context to inform your decomposition and ensure requirements align with existing project elements:\n\n${contextString}\n\nNow decompose the following text into structured requirements:\n\n${text}`
      : `Decompose the following text into structured requirements:\n\n${text}`;

    // Call Lovable AI to decompose the requirements
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert requirements analyst. Your task is to take unstructured text and decompose it into a hierarchical structure of requirements following this pattern:

Epic → Feature → User Story → Acceptance Criteria

Rules:
1. Create logical Epics that group related functionality
2. Break Epics into Features (specific capabilities)
3. Break Features into User Stories (user-facing functionality)
4. Break Stories into Acceptance Criteria (testable conditions)
5. Use clear, concise titles
6. Each level should have 2-5 children (avoid single children)
7. If project context is provided, align requirements with existing standards, tech stack, and architecture
8. Return ONLY valid JSON, no markdown or additional text

Return format:
{
  "epics": [
    {
      "title": "Epic title",
      "description": "Epic description",
      "features": [
        {
          "title": "Feature title",
          "description": "Feature description",
          "stories": [
            {
              "title": "As a [role], I want to [action] so that [benefit]",
              "description": "Story details",
              "acceptanceCriteria": [
                {
                  "title": "Given [context], when [action], then [outcome]",
                  "description": "Criteria details"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}`
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("AI response received, parsing...");
    
    // Parse the JSON response
    let requirements;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : content;
      requirements = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse requirements structure from AI response");
    }

    // Insert requirements into database using token-based RPC
    console.log("Inserting requirements into database...");

    for (const epic of requirements.epics) {
      const { data: epicData, error: epicError } = await supabase.rpc('insert_requirement_with_token', {
        p_project_id: projectId,
        p_token: shareToken,
        p_parent_id: null,
        p_type: "EPIC",
        p_title: epic.title,
      });

      if (epicError) {
        console.error("Error inserting epic:", epicError);
        throw epicError;
      }

      // Update with content if present
      if (epic.description) {
        const { error: updateError } = await supabase.rpc('update_requirement_with_token', {
          p_id: epicData.id,
          p_token: shareToken,
          p_title: epic.title,
          p_content: epic.description,
        });
        if (updateError) {
          console.error("Error updating epic content:", updateError);
        }
      }

      for (const feature of epic.features || []) {
        const { data: featureData, error: featureError } = await supabase.rpc('insert_requirement_with_token', {
          p_project_id: projectId,
          p_token: shareToken,
          p_parent_id: epicData.id,
          p_type: "FEATURE",
          p_title: feature.title,
        });

        if (featureError) {
          console.error("Error inserting feature:", featureError);
          throw featureError;
        }

        // Update with content if present
        if (feature.description) {
          const { error: updateError } = await supabase.rpc('update_requirement_with_token', {
            p_id: featureData.id,
            p_token: shareToken,
            p_title: feature.title,
            p_content: feature.description,
          });
          if (updateError) {
            console.error("Error updating feature content:", updateError);
          }
        }

        for (const story of feature.stories || []) {
          const { data: storyData, error: storyError } = await supabase.rpc('insert_requirement_with_token', {
            p_project_id: projectId,
            p_token: shareToken,
            p_parent_id: featureData.id,
            p_type: "STORY",
            p_title: story.title,
          });

          if (storyError) {
            console.error("Error inserting story:", storyError);
            throw storyError;
          }

          // Update with content if present
          if (story.description) {
            const { error: updateError } = await supabase.rpc('update_requirement_with_token', {
              p_id: storyData.id,
              p_token: shareToken,
              p_title: story.title,
              p_content: story.description,
            });
            if (updateError) {
              console.error("Error updating story content:", updateError);
            }
          }

          for (const criteria of story.acceptanceCriteria || []) {
            const { data: criteriaData, error: criteriaError } = await supabase.rpc('insert_requirement_with_token', {
              p_project_id: projectId,
              p_token: shareToken,
              p_parent_id: storyData.id,
              p_type: "ACCEPTANCE_CRITERIA",
              p_title: criteria.title,
            });

            if (criteriaError) {
              console.error("Error inserting criteria:", criteriaError);
              throw criteriaError;
            }

            // Update with content if present
            if (criteria.description) {
              const { error: updateError } = await supabase.rpc('update_requirement_with_token', {
                p_id: criteriaData.id,
                p_token: shareToken,
                p_title: criteria.title,
                p_content: criteria.description,
              });
              if (updateError) {
                console.error("Error updating criteria content:", updateError);
              }
            }
          }
        }
      }
    }

    console.log("Requirements decomposition complete");

    // Broadcast refresh to all connected clients
    if (requirements.epics.length > 0) {
      const channel = supabase.channel(`requirements-${projectId}`);
      await channel.send({
        type: 'broadcast',
        event: 'requirements_refresh',
        payload: { 
          projectId, 
          action: 'bulk_decompose', 
          epicCount: requirements.epics.length 
        }
      });
      console.log(`Broadcast sent for ${requirements.epics.length} decomposed epics`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Requirements decomposed and saved successfully",
        epicCount: requirements.epics.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in decompose-requirements:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
