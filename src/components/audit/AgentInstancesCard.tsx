import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AuditAgentInstance = Database["public"]["Tables"]["audit_agent_instances"]["Row"];

interface AgentInstancesCardProps {
  agents: AuditAgentInstance[];
  totalElements?: number;
}

const agentColors: Record<string, string> = {
  security_analyst: "text-red-500 bg-red-500/10",
  business_analyst: "text-blue-500 bg-blue-500/10",
  developer: "text-green-500 bg-green-500/10",
  end_user: "text-purple-500 bg-purple-500/10",
  architect: "text-orange-500 bg-orange-500/10",
};

export function AgentInstancesCard({ agents, totalElements = 0 }: AgentInstancesCardProps) {
  const activeCount = agents.filter((a) => a.status === "active").length;
  const completedCount = agents.filter((a) => a.sector_complete).length;

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Agent Instances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No agents spawned yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Agent Instances
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="default">{activeCount} active</Badge>
            <Badge variant="secondary">{completedCount}/{agents.length} done</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const colorClass = agentColors[agent.agent_role] || "text-muted-foreground bg-muted";
            const sectorSize = (agent.sector_end || 0) - (agent.sector_start || 0) + 1;
            const progress = agent.sector_complete ? 100 : 50;
            
            return (
              <div
                key={agent.id}
                className="flex flex-col gap-3 p-4 border rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-md ${colorClass}`}>
                      {agent.sector_complete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : agent.status === "active" ? (
                        <Clock className="h-4 w-4 animate-pulse" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm block">{agent.agent_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {agent.agent_role.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <Badge 
                    variant={agent.sector_complete ? "default" : "outline"} 
                    className="text-[10px]"
                  >
                    {agent.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Sector: {agent.sector_start}-{agent.sector_end}
                    </span>
                    <span className="text-muted-foreground">
                      {sectorSize} elements
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>

                {agent.consensus_vote !== null && (
                  <Badge 
                    variant={agent.consensus_vote ? "default" : "destructive"}
                    className="w-fit"
                  >
                    {agent.consensus_vote ? "✓ Consensus Vote" : "✗ No Consensus"}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
