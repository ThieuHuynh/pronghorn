import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user's auth for RPC calls
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for auth admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, role } = await req.json();

    console.log(`Admin management action: ${action}`, { email, role });

    switch (action) {
      case "list_users": {
        const { data, error } = await supabaseUser.rpc("get_admin_users");
        if (error) {
          console.error("Error listing users:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ users: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set_role": {
        if (!email || !role) {
          return new Response(
            JSON.stringify({ error: "Email and role are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabaseUser.rpc("set_user_role_by_email", {
          p_email: email,
          p_role: role,
        });

        if (error) {
          console.error("Error setting role:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!data.success) {
          return new Response(
            JSON.stringify({ error: data.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: data.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        if (!email) {
          return new Response(
            JSON.stringify({ error: "Email is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // First, delete user data via RPC (validates permissions)
        const { data, error } = await supabaseUser.rpc("delete_user_by_email", {
          p_email: email,
        });

        if (error) {
          console.error("Error deleting user data:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!data.success) {
          return new Response(
            JSON.stringify({ error: data.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Now delete auth user using service role
        const userId = data.user_id;
        if (userId) {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (authError) {
            console.error("Error deleting auth user:", authError);
            // User data is already deleted, so we return partial success
            return new Response(
              JSON.stringify({ 
                success: true, 
                warning: "User data deleted but auth record deletion failed",
                message: data.message 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "User account fully deleted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Admin management error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
