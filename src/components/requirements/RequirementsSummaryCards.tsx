import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Layers, 
  FileText, 
  CheckSquare,
  TrendingUp
} from "lucide-react";
import type { Requirement, RequirementType, RequirementStatus } from "./RequirementsTree";

interface RequirementsSummaryCardsProps {
  requirements: Requirement[];
}

interface CategoryStats {
  total: number;
  completed: number;
  percentage: number;
}

const COMPLETED_STATUSES: RequirementStatus[] = ["completed"];

// Flatten the requirements tree to get all items
function flattenRequirements(requirements: Requirement[]): Requirement[] {
  const result: Requirement[] = [];
  
  function traverse(items: Requirement[]) {
    for (const item of items) {
      result.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  
  traverse(requirements);
  return result;
}

// Calculate stats for a specific requirement type
function calculateStats(items: Requirement[], type: RequirementType): CategoryStats {
  const filtered = items.filter(item => item.type === type);
  const total = filtered.length;
  const completed = filtered.filter(item => 
    item.status && COMPLETED_STATUSES.includes(item.status as RequirementStatus)
  ).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { total, completed, percentage };
}

export function RequirementsSummaryCards({ requirements }: RequirementsSummaryCardsProps) {
  const stats = useMemo(() => {
    const flatList = flattenRequirements(requirements);
    
    const epics = calculateStats(flatList, "EPIC");
    const features = calculateStats(flatList, "FEATURE");
    const stories = calculateStats(flatList, "STORY");
    const acceptanceCriteria = calculateStats(flatList, "ACCEPTANCE_CRITERIA");
    
    const totalAll = epics.total + features.total + stories.total + acceptanceCriteria.total;
    const completedAll = epics.completed + features.completed + stories.completed + acceptanceCriteria.completed;
    const overallPercentage = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
    
    return {
      epics,
      features,
      stories,
      acceptanceCriteria,
      overall: {
        total: totalAll,
        completed: completedAll,
        percentage: overallPercentage
      }
    };
  }, [requirements]);

  const categories = [
    { 
      label: "Epics", 
      icon: Target, 
      stats: stats.epics,
      colorClass: "text-purple-500"
    },
    { 
      label: "Features", 
      icon: Layers, 
      stats: stats.features,
      colorClass: "text-blue-500"
    },
    { 
      label: "User Stories", 
      icon: FileText, 
      stats: stats.stories,
      colorClass: "text-green-500"
    },
    { 
      label: "Acceptance Criteria", 
      icon: CheckSquare, 
      stats: stats.acceptanceCriteria,
      colorClass: "text-amber-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {categories.map(({ label, icon: Icon, stats: catStats, colorClass }) => (
        <Card key={label} className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${colorClass}`} />
              <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{catStats.completed}</span>
              <span className="text-sm text-muted-foreground">/ {catStats.total}</span>
            </div>
            <div className="mt-2">
              <Progress value={catStats.percentage} className="h-1.5" />
              <span className="text-xs text-muted-foreground mt-1 block">
                {catStats.percentage}% complete
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Overall Progress Card */}
      <Card className="bg-card border-primary/20 col-span-2 md:col-span-3 lg:col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-primary">{stats.overall.percentage}%</span>
          </div>
          <div className="mt-2">
            <Progress value={stats.overall.percentage} className="h-1.5" />
            <span className="text-xs text-muted-foreground mt-1 block">
              {stats.overall.completed} of {stats.overall.total} items
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
