import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AgentMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  metadata: any;
  created_at: string;
}

export function useRealtimeAgentMessages(sessionId: string | null, shareToken: string | null) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Load messages
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    loadMessages();
  }, [sessionId, shareToken]);

  // Real-time subscription
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`agent-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const loadMessages = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_agent_messages_with_token", {
        p_session_id: sessionId,
        p_token: shareToken || null,
      });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, refetch: loadMessages };
}
