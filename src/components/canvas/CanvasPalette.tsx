import { NodeType } from "./NodePalette";
import { Eye, EyeOff } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LayersManager } from "./LayersManager";
import { Layer } from "@/hooks/useRealtimeLayers";
import { Node } from "reactflow";

const nodeIcons: Record<NodeType, string> = {
  PROJECT: "🎯",
  PAGE: "📄",
  COMPONENT: "⚛️",
  API: "🔌",
  DATABASE: "🗄️",
  SERVICE: "⚙️",
  WEBHOOK: "🪝",
  FIREWALL: "🛡️",
  SECURITY: "🔒",
  REQUIREMENT: "📋",
  STANDARD: "📏",
  TECH_STACK: "🔧",
};

const nodeLabels: Record<NodeType, string> = {
  PROJECT: "Project",
  PAGE: "Page",
  COMPONENT: "Component",
  API: "API",
  DATABASE: "Database",
  SERVICE: "Service",
  WEBHOOK: "Webhook",
  FIREWALL: "Firewall",
  SECURITY: "Security",
  REQUIREMENT: "Requirement",
  STANDARD: "Standard",
  TECH_STACK: "Tech Stack",
};

interface CanvasPaletteProps {
  visibleNodeTypes: Set<NodeType>;
  onToggleVisibility: (type: NodeType) => void;
  layers: Layer[];
  selectedNodes: Node[];
  onSaveLayer: (layer: Partial<Layer> & { id: string }) => void;
  onDeleteLayer: (layerId: string) => void;
  onSelectLayer: (nodeIds: string[]) => void;
}

export function CanvasPalette({
  visibleNodeTypes,
  onToggleVisibility,
  layers,
  selectedNodes,
  onSaveLayer,
  onDeleteLayer,
  onSelectLayer,
}: CanvasPaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const nodeTypes: NodeType[] = [
    "PROJECT",
    "PAGE",
    "COMPONENT",
    "API",
    "DATABASE",
    "SERVICE",
    "WEBHOOK",
    "FIREWALL",
    "SECURITY",
    "REQUIREMENT",
    "STANDARD",
    "TECH_STACK",
  ];

  return (
    <div className="w-64 border-r border-border bg-card p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-4">Canvas Palette</h3>

      <Accordion type="multiple" defaultValue={["nodes", "layers"]} className="space-y-2">
        <AccordionItem value="nodes" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Node Types
          </AccordionTrigger>
          <AccordionContent className="space-y-1 pb-2">
            {nodeTypes.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between gap-2 group"
              >
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-move flex-1 transition-colors ${
                    visibleNodeTypes.has(type)
                      ? "bg-muted hover:bg-muted/80"
                      : "bg-muted/30 hover:bg-muted/50 opacity-50"
                  }`}
                >
                  <span className="text-base">{nodeIcons[type]}</span>
                  <span className="text-xs font-medium">{nodeLabels[type]}</span>
                </div>
                <button
                  onClick={() => onToggleVisibility(type)}
                  className={`p-1 rounded transition-colors ${
                    visibleNodeTypes.has(type)
                      ? "text-foreground hover:text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={visibleNodeTypes.has(type) ? "Hide" : "Show"}
                >
                  {visibleNodeTypes.has(type) ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="layers" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Layers
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <LayersManager
              layers={layers}
              selectedNodes={selectedNodes}
              onSaveLayer={onSaveLayer}
              onDeleteLayer={onDeleteLayer}
              onSelectLayer={onSelectLayer}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
