import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface ProjectPageHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  actions?: ReactNode;
}

export function ProjectPageHeader({ title, subtitle, onMenuClick, actions }: ProjectPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
      <div className="flex items-start gap-2 md:gap-3 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="shrink-0 h-8 w-8 md:h-9 md:w-9 mt-1"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-sm md:text-base text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
