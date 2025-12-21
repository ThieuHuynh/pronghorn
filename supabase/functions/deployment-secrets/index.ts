import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENCRYPTION_KEY = Deno.env.get('SECRETS_ENCRYPTION_KEY');

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Encrypt using AES-GCM
async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error('SECRETS_ENCRYPTION_KEY not configured');
  }
  
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data
  );
  
  // Format: iv:ciphertext (both hex encoded)
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encrypted))}`;
}

// Decrypt using AES-GCM
async function decrypt(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error('SECRETS_ENCRYPTION_KEY not configured');
  }
  
  const [ivHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format');
  }
  
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const iv = hexToBytes(ivHex);
  const encrypted = hexToBytes(encryptedHex);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encrypted.buffer as ArrayBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    
    // Create client with user's auth for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} }
    });

    const { action, deploymentId, shareToken, secrets, envVars } = await req.json();
    
    console.log(`[deployment-secrets] Action: ${action}, Deployment: ${deploymentId}`);

    // Validate access via RPC (respects RLS)
    const { data: deployment, error: accessError } = await supabase.rpc(
      'get_deployment_with_secrets_with_token',
      { p_deployment_id: deploymentId, p_token: shareToken || null }
    );

    if (accessError) {
      console.error('[deployment-secrets] Access denied:', accessError.message);
      return new Response(
        JSON.stringify({ error: 'Access denied: ' + accessError.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deployment) {
      return new Response(
        JSON.stringify({ error: 'Deployment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get') {
      // Decrypt secrets and env_vars if they exist and are encrypted
      let decryptedSecrets = deployment.secrets || {};
      let decryptedEnvVars = deployment.env_vars || {};

      // Check if secrets are encrypted (stored as string with colon separator)
      if (typeof deployment.secrets === 'string' && deployment.secrets.includes(':')) {
        try {
          const decrypted = await decrypt(deployment.secrets);
          decryptedSecrets = JSON.parse(decrypted);
          console.log('[deployment-secrets] Successfully decrypted secrets');
        } catch (e) {
          console.log('[deployment-secrets] Secrets not encrypted or decrypt failed, using as-is');
          decryptedSecrets = deployment.secrets;
        }
      }

      if (typeof deployment.env_vars === 'string' && deployment.env_vars.includes(':')) {
        try {
          const decrypted = await decrypt(deployment.env_vars);
          decryptedEnvVars = JSON.parse(decrypted);
          console.log('[deployment-secrets] Successfully decrypted env_vars');
        } catch (e) {
          console.log('[deployment-secrets] Env vars not encrypted or decrypt failed, using as-is');
          decryptedEnvVars = deployment.env_vars;
        }
      }

      return new Response(
        JSON.stringify({ 
          secrets: decryptedSecrets, 
          envVars: decryptedEnvVars 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'set') {
      // Encrypt secrets and env_vars before storing
      let encryptedSecrets = null;
      let encryptedEnvVars = null;

      if (secrets !== undefined) {
        const secretsJson = JSON.stringify(secrets);
        encryptedSecrets = await encrypt(secretsJson);
        console.log('[deployment-secrets] Encrypted secrets');
      }

      if (envVars !== undefined) {
        const envVarsJson = JSON.stringify(envVars);
        encryptedEnvVars = await encrypt(envVarsJson);
        console.log('[deployment-secrets] Encrypted env_vars');
      }

      // Update using service role (RLS already validated above)
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (encryptedSecrets !== null) updateData.secrets = encryptedSecrets;
      if (encryptedEnvVars !== null) updateData.env_vars = encryptedEnvVars;

      const { error: updateError } = await serviceClient
        .from('project_deployments')
        .update(updateData)
        .eq('id', deploymentId);

      if (updateError) {
        console.error('[deployment-secrets] Update failed:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[deployment-secrets] Successfully updated encrypted secrets');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "get" or "set"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[deployment-secrets] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
