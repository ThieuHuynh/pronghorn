import { useState } from "react";
import { PrimaryNav } from "@/components/layout/PrimaryNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandardsTree, Standard } from "@/components/standards/StandardsTree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, Eye, Code, Lock, Zap } from "lucide-react";

// Mock data - will be loaded from Supabase in real implementation
const categoryIcons = {
  "Cyber Security": Shield,
  "Accessibility": Eye,
  "Application Standards": Code,
  "Data Privacy": Lock,
  "Performance": Zap,
};

const categoryColors = {
  "Cyber Security": "text-red-500",
  "Accessibility": "text-purple-500",
  "Application Standards": "text-blue-500",
  "Data Privacy": "text-orange-500",
  "Performance": "text-green-500",
};

const mockCategories = [
  {
    id: "1",
    name: "Cyber Security",
    description: "Security standards and frameworks including OWASP, NIST, and ISO",
    standardsCount: 45,
  },
  {
    id: "2",
    name: "Accessibility",
    description: "WCAG and accessibility compliance standards",
    standardsCount: 32,
  },
  {
    id: "3",
    name: "Application Standards",
    description: "Best practices for application development and architecture",
    standardsCount: 28,
  },
  {
    id: "4",
    name: "Data Privacy",
    description: "GDPR, CCPA, and data protection requirements",
    standardsCount: 18,
  },
  {
    id: "5",
    name: "Performance",
    description: "Performance benchmarks and optimization standards",
    standardsCount: 15,
  },
];

const mockStandards: Standard[] = [
  {
    id: "1",
    code: "OWASP-ASVS-V1",
    title: "V1: Architecture, Design and Threat Modeling",
    description: "Requirements related to application architecture, design and threat modeling",
    children: [
      {
        id: "1.1",
        code: "OWASP-ASVS-V1.1",
        title: "V1.1 Secure Software Development Lifecycle",
        description: "Requirements for secure development lifecycle practices",
        children: [
          {
            id: "1.1.1",
            code: "OWASP-ASVS-V1.1.1",
            title: "V1.1.1 Document security requirements",
            description: "Verify the use of a secure software development lifecycle",
          },
        ],
      },
      {
        id: "1.2",
        code: "OWASP-ASVS-V1.2",
        title: "V1.2 Authentication Architecture",
        description: "Requirements for authentication architecture",
      },
    ],
    attachments: [
      {
        id: "a1",
        type: "website",
        name: "OWASP ASVS Official Documentation",
        url: "https://owasp.org/www-project-application-security-verification-standard/",
      },
    ],
  },
  {
    id: "2",
    code: "OWASP-ASVS-V2",
    title: "V2: Authentication",
    description: "Authentication verification requirements",
    children: [
      {
        id: "2.1",
        code: "OWASP-ASVS-V2.1",
        title: "V2.1 Password Security",
        description: "Requirements for secure password handling",
      },
    ],
  },
];

export default function Standards() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Cyber Security");

  return (
    <div className="min-h-screen bg-background">
      <PrimaryNav />
      
      <main className="container px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Standards Library</h1>
          <p className="text-muted-foreground">
            Browse and manage compliance standards for your projects
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {mockCategories.map((category) => {
            const Icon = categoryIcons[category.name as keyof typeof categoryIcons];
            const color = categoryColors[category.name as keyof typeof categoryColors];
            const isSelected = selectedCategory === category.name;
            
            return (
              <Card
                key={category.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
                }`}
                onClick={() => setSelectedCategory(category.name)}
              >
                <CardHeader className="pb-3">
                  <div className={`h-10 w-10 rounded-lg bg-current/10 flex items-center justify-center mb-3 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="text-xs">
                    {category.standardsCount} standards
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Standards Browser */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Standards Tree */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{selectedCategory}</CardTitle>
              <CardDescription>
                Browse standards hierarchy and view details
              </CardDescription>
              
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search standards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <StandardsTree
                  standards={mockStandards}
                  onStandardSelect={setSelectedStandard}
                />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Details Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Standard Details</CardTitle>
              <CardDescription>
                {selectedStandard ? "View full specification" : "Select a standard to view details"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedStandard ? (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <Badge variant="outline" className="font-mono">
                        {selectedStandard.code}
                      </Badge>
                      <h3 className="text-lg font-semibold mt-2">{selectedStandard.title}</h3>
                    </div>

                    {selectedStandard.description && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedStandard.description}
                        </p>
                      </div>
                    )}

                    {selectedStandard.content && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Full Specification</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedStandard.content}
                        </p>
                      </div>
                    )}

                    {selectedStandard.attachments && selectedStandard.attachments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Resources</h4>
                        <div className="space-y-2">
                          {selectedStandard.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-2 rounded-lg border hover:bg-muted transition-colors"
                            >
                              <Badge variant="secondary" className="text-xs mt-0.5">
                                {att.type}
                              </Badge>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{att.name}</p>
                                {att.description && (
                                  <p className="text-xs text-muted-foreground">{att.description}</p>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                  Select a standard to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
