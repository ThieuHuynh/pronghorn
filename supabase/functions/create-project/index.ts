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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    const { projectData, techStackIds, requirementsText } = await req.json();
    
    console.log('[create-project] Starting project creation:', { 
      isAnonymous: !authHeader,
      projectName: projectData.name 
    });

    // Get user from auth header if present
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[create-project] User:', user ? user.id : 'anonymous');

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        created_by: user?.id || null,
      })
      .select('id, share_token')
      .single();

    if (projectError) {
      console.error('[create-project] Project creation error:', projectError);
      throw projectError;
    }

    console.log('[create-project] Project created:', { 
      id: project.id, 
      shareToken: project.share_token 
    });

    // Set share token in session for subsequent queries
    if (project.share_token) {
      await supabase.rpc('set_share_token', { token: project.share_token });
      console.log('[create-project] Share token set in session');
    }

    // Link tech stacks
    if (techStackIds && techStackIds.length > 0) {
      const techStackLinks = techStackIds.map((techStackId: string) => ({
        project_id: project.id,
        tech_stack_id: techStackId
      }));

      const { error: techStackError } = await supabase
        .from('project_tech_stacks')
        .insert(techStackLinks);

      if (techStackError) {
        console.error('[create-project] Tech stack linking error:', techStackError);
      } else {
        console.log('[create-project] Tech stacks linked:', techStackIds.length);
      }
    }

    // Process requirements if provided
    if (requirementsText && requirementsText.trim()) {
      console.log('[create-project] Invoking requirements decomposition');
      
      const { error: aiError } = await supabase.functions.invoke("decompose-requirements", {
        body: { 
          text: requirementsText.trim(), 
          projectId: project.id,
          shareToken: project.share_token 
        },
      });

      if (aiError) {
        console.error('[create-project] AI decomposition error:', aiError);
      } else {
        console.log('[create-project] Requirements decomposed successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: {
          id: project.id,
          shareToken: project.share_token,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[create-project] Fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
