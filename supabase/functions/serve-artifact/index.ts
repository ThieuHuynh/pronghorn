import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Infer Content-Type from source_type or content
function getContentType(sourceType: string | null, content: string): string {
  if (sourceType) {
    const typeMap: Record<string, string> = {
      'text/html': 'text/html; charset=utf-8',
      'text/css': 'text/css; charset=utf-8',
      'application/javascript': 'application/javascript; charset=utf-8',
      'text/javascript': 'application/javascript; charset=utf-8',
      'application/json': 'application/json; charset=utf-8',
      'text/markdown': 'text/markdown; charset=utf-8',
      'text/plain': 'text/plain; charset=utf-8',
      'text/xml': 'text/xml; charset=utf-8',
      'application/xml': 'application/xml; charset=utf-8',
      'text/csv': 'text/csv; charset=utf-8',
      'application/yaml': 'application/yaml; charset=utf-8',
      'text/yaml': 'text/yaml; charset=utf-8',
    };
    
    if (typeMap[sourceType]) {
      return typeMap[sourceType];
    }
    
    // If sourceType looks like a valid mime type, use it
    if (sourceType.includes('/')) {
      return `${sourceType}; charset=utf-8`;
    }
  }
  
  // Try to infer from content
  const trimmed = content.trim();
  
  if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
    return 'text/html; charset=utf-8';
  }
  
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'application/json; charset=utf-8';
    } catch {
      // Not valid JSON
    }
  }
  
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<svg')) {
    return 'text/xml; charset=utf-8';
  }
  
  // Check for CSS-like content
  if (/^[\s\S]*\{[\s\S]*:[\s\S]*\}/.test(trimmed) && 
      (trimmed.includes('color:') || trimmed.includes('background:') || 
       trimmed.includes('margin:') || trimmed.includes('padding:') ||
       trimmed.includes('font-') || trimmed.includes('display:'))) {
    return 'text/css; charset=utf-8';
  }
  
  return 'text/plain; charset=utf-8';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const artifactId = url.searchParams.get('id');
    const mode = url.searchParams.get('mode') || 'raw';
    const overrideType = url.searchParams.get('type'); // Optional: force a specific Content-Type

    if (!artifactId) {
      return new Response('Missing artifact ID', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(artifactId)) {
      return new Response('Invalid artifact ID format', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log(`[serve-artifact] Fetching artifact ${artifactId} in mode: ${mode}`);

    // Call the get_published_artifact RPC
    const { data: artifact, error } = await supabase.rpc('get_published_artifact', {
      p_artifact_id: artifactId
    });

    if (error) {
      console.error(`[serve-artifact] RPC error:`, error);
      return new Response('Error fetching artifact', { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    if (!artifact) {
      console.log(`[serve-artifact] Artifact not found or not published: ${artifactId}`);
      return new Response('Artifact not found or not published', { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    console.log(`[serve-artifact] Found artifact: ${artifact.ai_title || 'Untitled'}, source_type: ${artifact.source_type}`);

    // Handle binary mode - redirect to image URL
    if (mode === 'binary') {
      if (artifact.image_url) {
        console.log(`[serve-artifact] Redirecting to binary URL: ${artifact.image_url}`);
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': artifact.image_url,
          },
        });
      } else {
        return new Response('No binary content available for this artifact', { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        });
      }
    }

    // Handle raw mode - return content with appropriate Content-Type
    const content = artifact.content || '';
    const contentType = overrideType 
      ? `${overrideType}; charset=utf-8` 
      : getContentType(artifact.source_type, content);

    console.log(`[serve-artifact] Returning raw content with Content-Type: ${contentType}`);

    return new Response(content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300', // 5 minute cache
        'X-Artifact-Id': artifactId,
        'X-Artifact-Title': encodeURIComponent(artifact.ai_title || 'Untitled'),
      },
    });

  } catch (error) {
    console.error(`[serve-artifact] Unexpected error:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
});
