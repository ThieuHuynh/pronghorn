import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getProjectToken, setProjectToken } from "@/lib/tokenCache";

export function useShareToken(projectId?: string) {
  // Extract token from path params (new pattern: /project/:projectId/page/t/:token)
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  
  // Get token synchronously - check cache first, then URL params
  const getTokenSync = (): string | null => {
    // Check cache first for instant access
    if (projectId) {
      const cachedToken = getProjectToken(projectId);
      if (cachedToken) return cachedToken;
    }
    
    // Fall back to URL params
    const tokenFromPath = params.token;
    const tokenFromQuery = searchParams.get("token");
    return tokenFromPath || tokenFromQuery || null;
  };
  
  // Initialize state synchronously with best available token
  const [token, setToken] = useState<string | null>(getTokenSync);
  const [isTokenSet, setIsTokenSet] = useState(() => {
    // If we have a cached token or no projectId, we're ready immediately
    const cachedToken = projectId ? getProjectToken(projectId) : null;
    return !!cachedToken || !projectId;
  });

  useEffect(() => {
    // Priority: path param > query param (for backwards compatibility)
    const tokenFromPath = params.token;
    const tokenFromQuery = searchParams.get("token");
    const tokenParam = tokenFromPath || tokenFromQuery;
    
    if (tokenParam && projectId) {
      // Cache the token for synchronous access on future renders/navigations
      setProjectToken(projectId, tokenParam);
      setToken(tokenParam);
      
      // Set the share token in the Postgres session
      const setTokenInDb = async () => {
        const { error } = await supabase.rpc("set_share_token", { token: tokenParam });
        if (error) {
          console.error("Failed to set share token:", error);
        } else {
          setIsTokenSet(true);
        }
      };
      setTokenInDb();
    } else if (!tokenParam) {
      // No token needed (authenticated user), mark as ready
      setIsTokenSet(true);
    }
  }, [params.token, searchParams, projectId]);

  return { token, isTokenSet };
}
