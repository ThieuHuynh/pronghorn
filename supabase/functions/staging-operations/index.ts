import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StagingRequest {
  action: "stage" | "unstage" | "unstage_selected" | "discard_all" | "commit";
  repoId: string;
  shareToken: string | null;
  // For stage action
  filePath?: string;
  operationType?: string;
  oldContent?: string | null;
  newContent?: string | null;
  oldPath?: string | null;
  // For unstage action
  filePaths?: string[];
  // For commit action
  commitMessage?: string;
  branch?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    const request: StagingRequest = await req.json();
    const { action, repoId, shareToken } = request;

    console.log(`[staging-operations] Action: ${action}, RepoId: ${repoId}`);

    let result: any = null;

    switch (action) {
      case "stage": {
        const { filePath, operationType, oldContent, newContent, oldPath } = request;
        if (!filePath || !operationType) {
          throw new Error("filePath and operationType required for stage action");
        }

        const { data, error } = await supabase.rpc("stage_file_change_with_token", {
          p_repo_id: repoId,
          p_token: shareToken || null,
          p_file_path: filePath,
          p_operation_type: operationType,
          p_old_content: oldContent ?? null,
          p_new_content: newContent ?? null,
          p_old_path: oldPath ?? null,
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "unstage": {
        const { filePath } = request;
        if (!filePath) {
          throw new Error("filePath required for unstage action");
        }

        const { data, error } = await supabase.rpc("unstage_file_with_token", {
          p_repo_id: repoId,
          p_file_path: filePath,
          p_token: shareToken || null,
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "unstage_selected": {
        const { filePaths } = request;
        if (!filePaths || filePaths.length === 0) {
          throw new Error("filePaths required for unstage_selected action");
        }

        const { data, error } = await supabase.rpc("unstage_files_with_token", {
          p_repo_id: repoId,
          p_file_paths: filePaths,
          p_token: shareToken || null,
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "discard_all": {
        const { data, error } = await supabase.rpc("discard_staged_with_token", {
          p_repo_id: repoId,
          p_token: shareToken || null,
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "commit": {
        const { commitMessage, branch } = request;
        if (!commitMessage) {
          throw new Error("commitMessage required for commit action");
        }

        const { data, error } = await supabase.rpc("commit_staged_with_token", {
          p_repo_id: repoId,
          p_token: shareToken || null,
          p_commit_message: commitMessage,
          p_branch: branch || "main",
        });

        if (error) throw error;
        result = data;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Broadcast staging_refresh event after successful operation
    console.log(`[staging-operations] Broadcasting staging_refresh for repo: ${repoId}`);
    const channel = supabase.channel(`repo-staging-${repoId}`);
    await channel.send({
      type: "broadcast",
      event: "staging_refresh",
      payload: { repoId, action, timestamp: Date.now() },
    });
    await supabase.removeChannel(channel);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[staging-operations] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
