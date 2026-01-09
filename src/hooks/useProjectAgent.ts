import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentPromptSection {
  id: string;
  title: string;
  description: string;
  type: 'static' | 'dynamic';
  editable: 'editable' | 'readonly' | 'substitutable';
  order: number;
  content: string;
  variables?: string[];
  isCustom?: boolean;
  enabled?: boolean; // New: allows disabling sections
}

export interface ToolOperation {
  description: string;
  category: string;
  enabled: boolean;
}

export interface ToolsManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  file_operations: Record<string, ToolOperation>;
  project_exploration_tools: Record<string, ToolOperation>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  agentType: string;
  sections: AgentPromptSection[];
  toolsManifest?: ToolsManifest;
  isDefault?: boolean;
}

interface UseProjectAgentReturn {
  agentDefinition: AgentDefinition | null;
  sections: AgentPromptSection[];
  toolsManifest: ToolsManifest | null;
  loading: boolean;
  saving: boolean;
  hasCustomConfig: boolean;
  loadDefaultTemplate: () => Promise<AgentDefinition | null>;
  saveAgentConfig: (definition: AgentDefinition) => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  updateSection: (sectionId: string, updates: Partial<AgentPromptSection>) => void;
  toggleSection: (sectionId: string) => void;
  reorderSection: (sectionId: string, direction: 'up' | 'down') => void;
  addCustomSection: (section: AgentPromptSection) => void;
  removeSection: (sectionId: string) => void;
  updateToolsManifest: (manifest: ToolsManifest) => void;
  exportDefinition: () => string;
  importDefinition: (json: string) => boolean;
}

export function useProjectAgent(
  projectId: string,
  agentType: string = 'coding-agent-orchestrator',
  shareToken: string | null
): UseProjectAgentReturn {
  const [agentDefinition, setAgentDefinition] = useState<AgentDefinition | null>(null);
  const [sections, setSections] = useState<AgentPromptSection[]>([]);
  const [toolsManifest, setToolsManifest] = useState<ToolsManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState<AgentDefinition | null>(null);

  // Load the default tools manifest from JSON file
  const loadDefaultToolsManifest = useCallback(async (): Promise<ToolsManifest | null> => {
    try {
      const response = await fetch('/data/codingAgentToolsManifest.json');
      if (!response.ok) throw new Error('Failed to load tools manifest');
      const manifest = await response.json();
      setToolsManifest(manifest);
      return manifest;
    } catch (error) {
      console.error('Error loading tools manifest:', error);
      return null;
    }
  }, []);

  // Load the default template from JSON file
  const loadDefaultTemplate = useCallback(async (): Promise<AgentDefinition | null> => {
    try {
      const response = await fetch('/data/codingAgentPromptTemplate.json');
      if (!response.ok) throw new Error('Failed to load default template');
      const template = await response.json();
      setDefaultTemplate(template);
      return template;
    } catch (error) {
      console.error('Error loading default template:', error);
      toast.error('Failed to load default agent template');
      return null;
    }
  }, []);

  // Load agent configuration from database or use defaults
  const loadAgentConfig = useCallback(async () => {
    setLoading(true);
    try {
      // Load the default template and tools manifest in parallel
      const [template] = await Promise.all([
        loadDefaultTemplate(),
        loadDefaultToolsManifest(),
      ]);
      
      // Try to fetch custom config from database
      const { data, error } = await supabase.rpc('get_project_agent_with_token', {
        p_project_id: projectId,
        p_token: shareToken,
        p_agent_type: agentType,
      });

      if (error) {
        console.error('Error fetching agent config:', error);
        // Fall back to default template
        if (template) {
          setAgentDefinition(template);
          setSections(template.sections.map(s => ({ ...s, enabled: s.enabled ?? true })));
          setHasCustomConfig(false);
        }
        return;
      }

      if (data && data.length > 0) {
        // Custom config exists
        const customConfig = data[0];
        const definition: AgentDefinition = {
          id: customConfig.id,
          name: customConfig.name,
          version: customConfig.version,
          description: customConfig.description || '',
          agentType: customConfig.agent_type,
          sections: customConfig.sections as unknown as AgentPromptSection[],
          isDefault: customConfig.is_default,
        };
        setAgentDefinition(definition);
        setSections(definition.sections.map(s => ({ ...s, enabled: s.enabled ?? true })));
        setHasCustomConfig(true);
      } else if (template) {
        // No custom config, use default template
        setAgentDefinition(template);
        setSections(template.sections.map(s => ({ ...s, enabled: s.enabled ?? true })));
        setHasCustomConfig(false);
      }
    } catch (error) {
      console.error('Error in loadAgentConfig:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, agentType, shareToken, loadDefaultTemplate, loadDefaultToolsManifest]);

  useEffect(() => {
    if (projectId) {
      loadAgentConfig();
    }
  }, [projectId, loadAgentConfig]);

  // Save agent configuration to database
  const saveAgentConfig = useCallback(async (definition: AgentDefinition): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('upsert_project_agent_with_token', {
        p_project_id: projectId,
        p_token: shareToken,
        p_agent_type: agentType,
        p_name: definition.name,
        p_description: definition.description,
        p_version: definition.version,
        p_sections: definition.sections as any,
      });

      if (error) throw error;

      setAgentDefinition(definition);
      setSections(definition.sections);
      setHasCustomConfig(true);
      toast.success('Agent configuration saved');
      return true;
    } catch (error) {
      console.error('Error saving agent config:', error);
      toast.error('Failed to save agent configuration');
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, agentType, shareToken]);

  // Reset to default template
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      // Delete custom config from database
      const { error } = await supabase.rpc('delete_project_agent_with_token', {
        p_project_id: projectId,
        p_token: shareToken,
        p_agent_type: agentType,
      });

      if (error) throw error;

      // Reload default template
      const template = defaultTemplate || await loadDefaultTemplate();
      if (template) {
        setAgentDefinition(template);
        setSections(template.sections);
        setHasCustomConfig(false);
        toast.success('Reset to default configuration');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error resetting to default:', error);
      toast.error('Failed to reset configuration');
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, agentType, shareToken, defaultTemplate, loadDefaultTemplate]);

  // Update a single section
  const updateSection = useCallback((sectionId: string, updates: Partial<AgentPromptSection>) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    ));
  }, []);

  // Toggle section enabled/disabled
  const toggleSection = useCallback((sectionId: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId ? { ...section, enabled: !(section.enabled ?? true) } : section
    ));
  }, []);

  // Reorder section up or down
  const reorderSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex(s => s.id === sectionId);
      if (index === -1) return prev;
      
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return prev;
      
      // Swap orders
      const currentOrder = sorted[index].order;
      const targetOrder = sorted[targetIndex].order;
      
      return prev.map(section => {
        if (section.id === sectionId) return { ...section, order: targetOrder };
        if (section.id === sorted[targetIndex].id) return { ...section, order: currentOrder };
        return section;
      });
    });
  }, []);

  // Add a custom section
  const addCustomSection = useCallback((section: AgentPromptSection) => {
    setSections(prev => [...prev, { ...section, isCustom: true, enabled: true }].sort((a, b) => a.order - b.order));
  }, []);

  // Remove a section (only custom sections can be removed)
  const removeSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(section => 
      section.id !== sectionId || !section.isCustom
    ));
  }, []);

  // Update tools manifest
  const updateToolsManifest = useCallback((manifest: ToolsManifest) => {
    setToolsManifest(manifest);
  }, []);

  // Export current definition as JSON string
  const exportDefinition = useCallback((): string => {
    const definition: AgentDefinition = {
      id: agentDefinition?.id || 'custom-export',
      name: agentDefinition?.name || 'Custom Agent Definition',
      version: agentDefinition?.version || '1.0.0',
      description: agentDefinition?.description || 'Exported agent definition',
      agentType,
      sections,
    };
    return JSON.stringify(definition, null, 2);
  }, [agentDefinition, sections, agentType]);

  // Import definition from JSON string
  const importDefinition = useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json) as AgentDefinition;
      
      // Validate structure
      if (!imported.sections || !Array.isArray(imported.sections)) {
        throw new Error('Invalid definition: sections array is required');
      }

      // Validate each section has required fields
      for (const section of imported.sections) {
        if (!section.id || !section.title || !section.content) {
          throw new Error(`Invalid section: missing required fields (id, title, content)`);
        }
      }

      // Apply imported definition
      setAgentDefinition({
        ...imported,
        agentType, // Ensure agent type matches
      });
      setSections(imported.sections.sort((a, b) => (a.order || 0) - (b.order || 0)));
      toast.success('Agent definition imported successfully');
      return true;
    } catch (error: any) {
      console.error('Error importing definition:', error);
      toast.error(error.message || 'Failed to import agent definition');
      return false;
    }
  }, [agentType]);

  return {
    agentDefinition,
    sections,
    toolsManifest,
    loading,
    saving,
    hasCustomConfig,
    loadDefaultTemplate,
    saveAgentConfig,
    resetToDefault,
    updateSection,
    toggleSection,
    reorderSection,
    addCustomSection,
    removeSection,
    updateToolsManifest,
    exportDefinition,
    importDefinition,
  };
}
