# Pronghorn (Alpha)

**Build Software with AI-Powered Precision**

A standards-first, agentic AI platform that transforms unstructured requirements into production-ready code with complete traceability. From idea to deployment, Pronghorn orchestrates multi-agent AI teams to design, build, and ship software autonomously.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4)](https://lovable.dev)
[![Powered by Supabase](https://img.shields.io/badge/Powered%20by-Supabase-3ECF8E)](https://supabase.com)

**Live Application**: [https://pronghorn.red](https://pronghorn.red)

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [AI Agents & Orchestration](#ai-agents--orchestration)
- [Database Management](#database-management)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Authentication System](#authentication-system)
- [Multi-Token RBAC System](#multi-token-rbac-system)
- [RPC Patterns](#rpc-patterns)
- [Edge Functions](#edge-functions)
- [Real-Time Subscriptions](#real-time-subscriptions)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Legal](#legal)
- [Contact](#contact)

---

## Overview

Pronghorn is an open-source AI-powered software development platform created by the **Government of Alberta, Ministry of Technology and Innovation**. It enables teams to:

- **Design** → Transform ideas into structured requirements with AI decomposition
- **Build** → Generate production code with autonomous AI coding agents
- **Ship** → Deploy to cloud platforms with integrated CI/CD

The platform operates in multiple modes:
1. **Design Mode**: Visual specification building with React Flow canvas
2. **Audit Mode**: Multi-agent cross-comparison between project datasets
3. **Build Mode**: Autonomous code generation with real-time monitoring
4. **Present Mode**: AI-generated project presentations with blackboard reasoning

---

## Core Features

### 🎯 AI-Powered Requirements
Transform unstructured ideas into hierarchical specifications:
- **Epics** → **Features** → **User Stories** → **Acceptance Criteria**
- AI decomposition via LLM providers (Gemini, Claude, Grok)
- Automatic linking to organizational standards for complete traceability

### 📋 Global Standards Library
Reusable compliance templates across your organization:
- User-customizable categories and hierarchical trees
- Dynamic linking to all projects (updates propagate automatically)
- Tech stack templates with associated standards

### 🎨 Visual Architecture Design
Interactive canvas for system design:
- 24+ node types (WEB_COMPONENT, API_ROUTER, DATABASE, SCHEMA, TABLE, etc.)
- Data-driven node types from database (add types without code changes)
- Real-time collaboration with multi-user editing
- Layer management for complex diagrams
- Lasso selection for bulk operations

### 📊 AI Presentation Generator
Create professional Gamma-style presentations from project data:
- **Blackboard Memory Pattern**: Agent sequentially reads project data, accumulates insights
- **15+ Slide Layouts**: Cover, bullets, stats grid, architecture, timeline, comparison, etc.
- **Multiple Themes**: Professional Dark, Clean Light, Vibrant Gradient
- **Mode Options**: Concise (10-15 slides) or Detailed (20-30 slides)
- **Cover Image Generation**: AI-generated cover images with style selection (Photorealistic, Illustrated, Abstract, Cartoon, Whiteboard, Infographic)
- **PDF Export**: High-quality PDF generation with slide notes (low/high resolution)
- **Real-time Editing**: Edit slides, notes, layouts, and font scaling per slide
- **JSON/Markdown Export**: Download for backup or import into external tools

### 🔍 Multi-Agent Audit System
Cognitive cross-comparison between project datasets:
- **Dataset Comparison**: Compare Requirements ↔ Canvas, Canvas ↔ Repository, Standards ↔ Code
- **1:1 and 1:Many Modes**: Compare single pairs or iterate one dataset against another
- **Tesseract Evidence Grid**: 3D visualization (X: elements, Y: iterations, Z: polarity scores)
- **Knowledge Graph**: Visual concept mapping with force-directed layout
- **Multi-Perspective Agents**: Security Analyst, Business Analyst, Developer, End User, Architect
- **Venn Diagram Output**: Unique to D1, Aligned, Unique to D2 (Challenges)
- **Blackboard Collaboration**: Agents share findings on append-only blackboard
- **Consensus Voting**: Agents vote when analysis is complete
- **Local-First Processing**: All processing happens client-side until explicit save

### 📚 Build Books
Curated organizational templates:
- **Standards Collections**: Pre-packaged compliance standards
- **Tech Stack Bundles**: Recommended technology combinations
- **Organization Branding**: Custom covers and descriptions
- **Apply to Projects**: One-click application of standards and tech stacks
- **Admin Publishing**: Draft/Published workflow for admins
- **Gallery Discovery**: Browse and clone published Build Books

### 🤝 Collaborative Document Editing
Real-time AI-assisted document editing:
- **CollaborationAgent**: AI partner for document refinement
- **Line-Level Operations**: Precise edit_lines with surgical changes
- **Project Context Attachment**: Include requirements, canvas, artifacts as context
- **Change Tracking**: Real-time diff visualization with timeline
- **Human-First Approach**: AI respects human edits, never replaces entire documents
- **Merge to Artifact**: Integrate changes back to original document

### 🖼️ Project Gallery
Discover and clone public projects:
- **Browse Published Projects**: Explore community-shared projects
- **Preview Mode**: View project details before cloning
- **One-Click Clone**: Clone any public project to your dashboard
- **Search & Filter**: Find projects by tags, name, or description

### 💻 AI Coding Agent
Autonomous file operations with full Git workflow:
- Read, edit, create, delete, rename files
- Staging → Commit → Push workflow
- Real-time progress monitoring with operation timeline
- Support for pause/resume and abort operations
- Raw LLM logs viewer for debugging

### ⚡ Instant Collaboration
No-login-required sharing:
- Token-based project access with role hierarchy
- Anonymous project creation with session persistence
- Real-time Supabase subscriptions for live updates
- Token Management UI for owners

---

## AI Agents & Orchestration

### 🤖 Multi-Agent AI Teams
Orchestrated AI specialists working together on canvas design:

| Agent | Focus |
|-------|-------|
| **Architect Agent** | System structure and component hierarchy |
| **Developer Agent** | Implementation details and code patterns |
| **DBA Agent** | Database schemas and data modeling |
| **Security Agent** | Vulnerability assessment and secure patterns |
| **QA Agent** | Test coverage and validation strategies |
| **DevOps Agent** | Deployment and infrastructure |
| **UX Agent** | User experience and interface design |
| **API Agent** | API design and integration patterns |
| **Performance Agent** | Optimization and scalability |
| **Documentation Agent** | Technical documentation |

Agents share a blackboard for iterative refinement across multiple epochs with critic review.

### 📝 Specification Agents
Generate comprehensive documents from project data:

| Agent | Output |
|-------|--------|
| **Overview** | Executive summary and project scope |
| **Technical Specification** | Detailed technical documentation |
| **Cloud Architecture** | AWS/Azure/GCP infrastructure design |
| **API Specification** | OpenAPI/REST endpoint documentation |
| **Security Analysis** | Threat modeling and security controls |
| **Data Requirements** | Data models and storage requirements |
| **Accessibility** | WCAG compliance and accessibility audit |
| **Internationalization** | i18n/l10n requirements |
| **DevOps** | CI/CD and deployment strategies |
| **Testing** | Test strategy and coverage plans |
| **Standards Compliance** | Regulatory compliance mapping |
| **Executive Summary** | Business-focused project overview |
| **Project Charter** | Governance and stakeholder documentation |

### 🔍 Audit Agents
Multi-perspective analysis for cross-comparison:

| Agent | Perspective |
|-------|-------------|
| **Security Analyst** | Vulnerability and risk assessment |
| **Business Analyst** | Business value and ROI analysis |
| **Developer** | Implementation feasibility |
| **End User** | Usability and user experience |
| **Architect** | System design and patterns |

---

## Database Management

Pronghorn provides full PostgreSQL database lifecycle management with AI-powered data import.

### 🗄️ Provision & Connect

| Feature | Description |
|---------|-------------|
| **One-Click Provisioning** | Create PostgreSQL databases via Render.com with automatic configuration |
| **External Connections** | Connect to any PostgreSQL instance (AWS RDS, Aurora, Neon, Railway, etc.) |
| **SSL Configuration** | Support for `require`, `prefer`, `disable` SSL modes |
| **Status Tracking** | Real-time database status (pending, creating, available, error, suspended) |
| **Connection Testing** | Verify connectivity with 10-second timeout handling |
| **Secure Storage** | Connection strings stored encrypted via edge function secrets |

### 🔗 External Database Support

Connect to any PostgreSQL-compatible database:
- **AWS RDS/Aurora**: Standard PostgreSQL connections with public accessibility
- **Neon/Supabase/Railway**: Cloud PostgreSQL providers
- **Self-Hosted**: Any PostgreSQL 12+ instance
- **Connection Timeout**: 10-second timeout for unresponsive hosts
- **Network Guidance**: Help for configuring security groups and VPC access

### 🔍 Schema Explorer

Browse and manage your database structure:
- **Tables** - View columns, types, constraints, and indexes
- **Views** - Materialized and standard views
- **Functions** - PostgreSQL functions and procedures
- **Triggers** - Database triggers with timing and events
- **Indexes** - B-tree, hash, GIN, GiST indexes
- **Sequences** - Auto-increment sequences
- **Types** - Custom PostgreSQL types

### 📝 SQL Query Editor

Full-featured Monaco-powered SQL editor:
- **VS Code Engine** - Syntax highlighting, auto-complete
- **Query Execution** - Run queries with timing and result pagination
- **Saved Queries** - Store frequently used queries per database
- **Query History** - Access recent queries with keyboard shortcuts
- **Result Export** - Export data as JSON, CSV, or SQL INSERT statements
- **Destructive Query Warnings** - Visual indicators for DROP, DELETE, TRUNCATE

### 📥 Data Import Wizard

Multi-step wizard for importing data from files:

| Step | Description |
|------|-------------|
| **1. Upload** | Drag-and-drop Excel (.xlsx, .xls), CSV, or JSON files |
| **2. Preview** | View parsed data with automatic sheet/table detection |
| **3. Schema** | AI-inferred or manual schema with type casting |
| **4. Review** | SQL preview with batched INSERT statements |
| **5. Execute** | Progress tracking with pause/resume capability |

**AI Schema Inference:**
- Automatic type detection (TEXT, INTEGER, BIGINT, NUMERIC, BOOLEAN, DATE, TIMESTAMP, JSONB)
- Primary key recommendations
- Index suggestions for common patterns
- Foreign key relationship detection (JSON files)
- Entity-Relationship Diagram (ERD) visualization

### 📋 Migration Tracking

Automatic DDL statement history:
- **CREATE** - Tables, views, functions, indexes
- **ALTER** - Column additions, type changes, constraints
- **DROP** - Tracked for audit trail
- **Object Metadata** - Schema, name, type for each migration
- **Execution Log** - Timestamp, user, and full SQL content

---

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with TypeScript |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Accessible component library |
| **React Flow** | Interactive canvas diagrams |
| **Monaco Editor** | Code editing (VS Code engine) |
| **TanStack Query** | Server state management |
| **React Router DOM** | Client-side routing |
| **Framer Motion** | Animations and transitions |
| **Recharts** | Data visualization and charts |
| **jsPDF** | PDF generation |
| **html-to-image** | Screenshot/image capture |

### Backend (Supabase)

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Row Level Security** | Token-based access control |
| **Edge Functions** | Deno serverless functions (53 functions) |
| **Realtime** | WebSocket subscriptions |
| **Storage** | File and artifact storage |

### LLM Providers

| Provider | Chat Models | Image Models |
|----------|-------------|--------------|
| **Google Gemini** | gemini-2.5-flash, gemini-2.5-pro | gemini-2.5-flash-image, gemini-3-pro-image-preview |
| **Anthropic Claude** | claude-opus-4-5 | - |
| **xAI Grok** | grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning | - |

---

## Project Structure

```
pronghorn/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui base components
│   │   ├── canvas/                # React Flow canvas components
│   │   │   ├── CanvasNode.tsx     # Node rendering
│   │   │   ├── CanvasPalette.tsx  # Node type selector
│   │   │   ├── AgentFlow.tsx      # Multi-agent orchestration UI
│   │   │   ├── AIArchitectDialog.tsx
│   │   │   ├── LayersManager.tsx
│   │   │   ├── Lasso.tsx
│   │   │   └── ...
│   │   ├── build/                 # Coding agent interface
│   │   │   ├── UnifiedAgentInterface.tsx
│   │   │   ├── AgentProgressMonitor.tsx
│   │   │   ├── StagingPanel.tsx
│   │   │   ├── RawLLMLogsViewer.tsx
│   │   │   └── ...
│   │   ├── deploy/                # Database & deployment components
│   │   │   ├── DatabaseExplorer.tsx      # Schema browser & SQL editor
│   │   │   ├── DatabaseImportWizard.tsx  # Multi-step data import
│   │   │   ├── SqlQueryEditor.tsx        # Monaco SQL editor
│   │   │   ├── ConnectDatabaseDialog.tsx # External DB connections
│   │   │   ├── ExternalDatabaseCard.tsx
│   │   │   ├── import/                   # Import wizard sub-components
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   ├── ExcelDataGrid.tsx
│   │   │   │   ├── SchemaCreator.tsx
│   │   │   │   ├── DatabaseErdView.tsx
│   │   │   │   ├── JsonRelationshipFlow.tsx
│   │   │   │   └── SqlReviewPanel.tsx
│   │   │   └── ...
│   │   ├── present/               # Presentation generator components
│   │   │   ├── SlideRenderer.tsx
│   │   │   ├── SlideCanvas.tsx
│   │   │   ├── SlideThumbnails.tsx
│   │   │   ├── LayoutSelector.tsx
│   │   │   ├── FontScaleControl.tsx
│   │   │   ├── SlideImageGenerator.tsx
│   │   │   ├── PdfExportRenderer.tsx
│   │   │   └── ...
│   │   ├── audit/                 # Multi-agent audit components
│   │   │   ├── AuditConfigurationDialog.tsx
│   │   │   ├── AuditBlackboard.tsx
│   │   │   ├── TesseractVisualizer.tsx
│   │   │   ├── VennDiagramResults.tsx
│   │   │   ├── KnowledgeGraph.tsx
│   │   │   ├── KnowledgeGraphWebGL.tsx
│   │   │   ├── PipelineActivityStream.tsx
│   │   │   └── ...
│   │   ├── collaboration/         # Collaborative editing
│   │   │   ├── CollaborationEditor.tsx
│   │   │   ├── CollaborationChat.tsx
│   │   │   ├── CollaborationTimeline.tsx
│   │   │   ├── CollaborationHeatmap.tsx
│   │   │   └── ...
│   │   ├── buildbook/             # Build Book components
│   │   │   ├── BuildBookCard.tsx
│   │   │   ├── BuildBookChat.tsx
│   │   │   ├── ApplyBuildBookDialog.tsx
│   │   │   └── ...
│   │   ├── gallery/               # Project gallery components
│   │   │   ├── GalleryCard.tsx
│   │   │   ├── GalleryPreviewDialog.tsx
│   │   │   ├── GalleryCloneDialog.tsx
│   │   │   └── ...
│   │   ├── artifacts/             # Artifact management
│   │   │   ├── ArtifactPdfViewer.tsx
│   │   │   ├── ArtifactDocxViewer.tsx
│   │   │   ├── ArtifactExcelViewer.tsx
│   │   │   ├── VisualRecognitionDialog.tsx
│   │   │   ├── EnhanceImageDialog.tsx
│   │   │   └── ...
│   │   ├── repository/            # File tree, editor, Git integration
│   │   │   ├── FileTree.tsx
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── IDEModal.tsx
│   │   │   ├── ContentSearchDialog.tsx
│   │   │   └── ...
│   │   ├── requirements/          # Requirements tree management
│   │   ├── standards/             # Standards library UI
│   │   ├── specifications/        # Specification generation
│   │   ├── dashboard/             # Project cards, creation dialogs
│   │   ├── layout/                # Navigation, sidebar, header
│   │   └── project/               # Project-specific selectors
│   │       ├── TokenManagement.tsx      # Token CRUD UI
│   │       ├── AccessLevelBanner.tsx
│   │       └── ...
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Authentication state & methods
│   │   └── AdminContext.tsx       # Admin mode management
│   │
│   ├── hooks/
│   │   ├── useShareToken.ts       # Token extraction & caching
│   │   ├── useAuditPipeline.ts    # Audit orchestration state
│   │   ├── useRealtimeCanvas.ts   # Canvas real-time sync
│   │   ├── useRealtimeRequirements.ts
│   │   ├── useRealtimeArtifacts.ts
│   │   ├── useRealtimeLayers.ts
│   │   ├── useRealtimeCollaboration.ts
│   │   ├── useRealtimeBuildBooks.ts
│   │   ├── useInfiniteAgentMessages.ts
│   │   ├── useInfiniteAgentOperations.ts
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Landing.tsx            # Marketing landing page
│   │   ├── Dashboard.tsx          # Project list
│   │   ├── Auth.tsx               # Login/signup/SSO
│   │   ├── Gallery.tsx            # Public project gallery
│   │   ├── BuildBooks.tsx         # Build Book catalog
│   │   ├── BuildBookDetail.tsx    # Build Book viewer
│   │   ├── BuildBookEditor.tsx    # Build Book editor (admin)
│   │   ├── Standards.tsx          # Global standards library
│   │   ├── TechStacks.tsx         # Tech stack management
│   │   ├── Settings.tsx           # User settings
│   │   ├── Terms.tsx              # Terms of Use
│   │   ├── Privacy.tsx            # Privacy Policy
│   │   └── project/               # Project-specific pages
│   │       ├── Requirements.tsx
│   │       ├── Canvas.tsx
│   │       ├── Build.tsx
│   │       ├── Repository.tsx
│   │       ├── Artifacts.tsx
│   │       ├── Chat.tsx
│   │       ├── Deploy.tsx
│   │       ├── Database.tsx
│   │       ├── Audit.tsx
│   │       ├── Present.tsx
│   │       ├── Specifications.tsx
│   │       ├── Standards.tsx
│   │       └── ProjectSettings.tsx
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts          # Supabase client singleton
│   │       └── types.ts           # Generated TypeScript types
│   │
│   ├── lib/
│   │   ├── tokenCache.ts          # Synchronous token caching
│   │   ├── connectionLogic.ts     # Canvas edge validation
│   │   ├── stagingOperations.ts   # Git staging utilities
│   │   ├── presentationPdfExport.ts
│   │   ├── sqlParser.ts           # SQL parsing utilities
│   │   └── utils.ts               # Utility functions
│   │
│   └── main.tsx                   # Application entry point
│
├── supabase/
│   ├── functions/                 # 53 Deno edge functions (see below)
│   └── config.toml                # Supabase configuration
│
├── public/
│   ├── data/
│   │   ├── agents.json                    # Specification agents (13 types)
│   │   ├── buildAgents.json               # Canvas multi-agent definitions (10 agents)
│   │   ├── connectionLogic.json           # Canvas edge validation rules
│   │   ├── graphicStyles.json             # Image generation styles (6 categories)
│   │   ├── presentAgentInstructions.json  # Presentation agent blackboard spec
│   │   ├── presentationLayouts.json       # 15 slide layouts + themes
│   │   ├── auditAgentInstructions.json    # Audit orchestrator specification
│   │   ├── codingAgentInstructions.json   # Coding agent tools & patterns
│   │   ├── collaborationAgentInstructions.json  # Document collaboration agent
│   │   └── deploymentSettings.json        # Multi-runtime deploy configurations
│   │
│   └── features/
│       └── audit.md                       # Audit system documentation
│
└── README.md
```

---

## Authentication System

Pronghorn implements a **dual access model** supporting both authenticated users and anonymous collaboration.

### Authentication Methods

| Method | Description |
|--------|-------------|
| **Email/Password** | Traditional signup and login |
| **Google SSO** | OAuth 2.0 redirect flow |
| **Microsoft Azure SSO** | OAuth 2.0 with Azure AD |
| **Anonymous** | Token-based access (no login required) |

### Auth Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AuthContext Provider                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Email/Password  │    │   Social SSO     │                   │
│  ├──────────────────┤    ├──────────────────┤                   │
│  │ signUp()         │    │ signInWithGoogle │                   │
│  │ signIn()         │    │ signInWithAzure  │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       ▼                                          │
│            ┌─────────────────────┐                               │
│            │  Supabase Auth      │                               │
│            │  onAuthStateChange  │                               │
│            └──────────┬──────────┘                               │
│                       ▼                                          │
│            ┌─────────────────────┐                               │
│            │  Session + User     │                               │
│            │  State Updated      │                               │
│            └─────────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SSO Configuration

**Google OAuth:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/dashboard`,
    skipBrowserRedirect: false  // Forces full page redirect
  }
});
```

**Microsoft Azure:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    scopes: 'openid profile email',
    redirectTo: `${window.location.origin}/dashboard`,
    skipBrowserRedirect: false
  }
});
```

The callback flow:
1. User clicks SSO button → Redirects to provider
2. Provider authenticates → Redirects to Supabase callback
3. Supabase exchanges tokens → Redirects to `/dashboard`

---

## Multi-Token RBAC System

Pronghorn implements a sophisticated role-based access control system using project tokens.

### Token Architecture

```sql
-- project_tokens table
CREATE TABLE project_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  role project_token_role NOT NULL DEFAULT 'viewer',
  label TEXT,                    -- Human-readable name
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,        -- Optional expiration
  last_used_at TIMESTAMPTZ,      -- Usage tracking
  UNIQUE(token)
);

-- Role hierarchy
CREATE TYPE project_token_role AS ENUM ('owner', 'editor', 'viewer');
```

### Role Permissions

| Role | Permissions |
|------|-------------|
| **Owner** | Full access: manage tokens, delete project, all CRUD operations |
| **Editor** | Create, read, update operations (no token management or deletion) |
| **Viewer** | Read-only access to all project data |

### URL Pattern

```
/project/{projectId}/{page}/t/{token}

Examples:
/project/abc123/canvas/t/def456
/project/abc123/requirements/t/def456
/project/abc123/build/t/def456
```

### Token Management UI

Manage project access tokens from Project Settings:
- **Create Tokens**: Generate new viewer, editor, or owner tokens with optional labels
- **Set Expiration**: Optional token expiry dates
- **Copy Share Links**: One-click copy of shareable URLs
- **Roll Tokens**: Regenerate token values while keeping the same ID
- **Revoke Access**: Delete tokens to remove access
- **Current Token Indicator**: Shows which token is currently in use

### Core Authorization Functions

**1. authorize_project_access** - Validates access and returns role:

```sql
CREATE FUNCTION authorize_project_access(
  p_project_id UUID,
  p_token UUID DEFAULT NULL
) RETURNS project_token_role AS $$
BEGIN
  -- Check 1: Authenticated owner
  IF auth.uid() IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND created_by = auth.uid()) THEN
      RETURN 'owner';
    END IF;
  END IF;
  
  -- Check 2: Valid token in project_tokens
  IF p_token IS NOT NULL THEN
    -- Return role from project_tokens if valid and not expired
    ...
  END IF;
  
  RAISE EXCEPTION 'Access denied';
END;
$$;
```

**2. require_role** - Enforces minimum permission level:

```sql
CREATE FUNCTION require_role(
  p_project_id UUID,
  p_token UUID,
  p_min_role project_token_role
) RETURNS project_token_role AS $$
DECLARE
  v_current_role project_token_role;
BEGIN
  v_current_role := authorize_project_access(p_project_id, p_token);
  
  -- Role hierarchy: owner(3) > editor(2) > viewer(1)
  IF role_to_level(v_current_role) < role_to_level(p_min_role) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  RETURN v_current_role;
END;
$$;
```

---

## RPC Patterns

All database operations use **SECURITY DEFINER** RPC functions with token validation.

### Client-Side Pattern

```typescript
import { supabase } from "@/integrations/supabase/client";
import { useShareToken } from "@/hooks/useShareToken";

function MyComponent({ projectId }: { projectId: string }) {
  const { token: shareToken, isTokenSet } = useShareToken(projectId);
  
  const loadData = async () => {
    // Wait for token to be ready
    if (!isTokenSet) return;
    
    const { data, error } = await supabase.rpc('get_requirements_with_token', {
      p_project_id: projectId,
      p_token: shareToken || null  // null for authenticated owners
    });
  };
}
```

### RPC Function Structure

```sql
-- Read operation (requires viewer role)
CREATE FUNCTION get_requirements_with_token(
  p_project_id UUID,
  p_token UUID DEFAULT NULL
) RETURNS SETOF requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate access - require at least viewer role
  PERFORM require_role(p_project_id, p_token, 'viewer');
  
  RETURN QUERY 
    SELECT * FROM requirements 
    WHERE project_id = p_project_id
    ORDER BY order_index;
END;
$$;

-- Write operation (requires editor role)
CREATE FUNCTION insert_requirement_with_token(
  p_project_id UUID,
  p_token UUID,
  p_title TEXT,
  p_type requirement_type,
  p_parent_id UUID DEFAULT NULL
) RETURNS requirements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result requirements;
BEGIN
  -- Validate access - require at least editor role
  PERFORM require_role(p_project_id, p_token, 'editor');
  
  INSERT INTO requirements (project_id, title, type, parent_id)
  VALUES (p_project_id, p_title, p_type, p_parent_id)
  RETURNING * INTO result;
  
  RETURN result;
END;
$$;
```

### Token Caching

Tokens are cached in memory for synchronous access:

```typescript
// src/lib/tokenCache.ts
const tokenCache = new Map<string, string>();

export function setProjectToken(projectId: string, token: string): void {
  tokenCache.set(projectId, token);
}

export function getProjectToken(projectId: string): string | null {
  return tokenCache.get(projectId) || null;
}

export function clearProjectToken(projectId: string): void {
  tokenCache.delete(projectId);
}
```

---

## Edge Functions

Pronghorn includes **53 Deno edge functions** for server-side operations.

### Project Management

| Function | Purpose |
|----------|---------|
| `create-project` | Project creation with token generation |
| `delete-project` | Secure project deletion with cascade |
| `clone-project` | Full project cloning with all data |
| `project-activity` | Activity analytics by time period |
| `log-activity` | Activity event logging |

### AI Agents & Orchestration

| Function | Purpose |
|----------|---------|
| `orchestrate-agents` | Multi-agent canvas design iteration |
| `ai-architect` | Architecture generation |
| `ai-architect-critic` | Architecture review and critique |
| `coding-agent-orchestrator` | Autonomous coding agent with file operations |
| `presentation-agent` | Blackboard-based slide generation |
| `collaboration-agent-orchestrator` | Collaborative document editing |
| `audit-orchestrator` | Multi-agent audit coordination |
| `audit-extract-concepts` | Concept extraction for audit datasets |
| `audit-merge-concepts` | Concept merging across datasets |
| `audit-merge-concepts-v2` | Enhanced concept merging with graph linking |
| `audit-generate-venn` | Venn diagram synthesis from knowledge graph |
| `audit-build-tesseract` | Evidence grid construction |
| `audit-enhanced-sort` | Smart sorting for audit data |

### Requirements & Standards

| Function | Purpose |
|----------|---------|
| `decompose-requirements` | AI decomposition into Epics/Features/Stories |
| `expand-requirement` | Expand single requirement with AI |
| `expand-standards` | Generate standards from descriptions |
| `ai-create-standards` | Bulk AI standards generation |
| `generate-specification` | Specification document generation |

### Chat & Streaming

| Function | Purpose |
|----------|---------|
| `chat-stream-gemini` | Gemini streaming chat with SSE |
| `chat-stream-anthropic` | Claude streaming chat with SSE |
| `chat-stream-xai` | Grok streaming chat with SSE |
| `summarize-chat` | Chat session summarization |
| `summarize-artifact` | Artifact content summarization |

### Image & Media

| Function | Purpose |
|----------|---------|
| `generate-image` | AI image generation (Gemini) |
| `enhance-image` | Image editing/creation with Gemini image models |
| `upload-artifact-image` | Image upload to Supabase storage |
| `visual-recognition` | OCR and document text extraction |
| `ingest-artifacts` | Bulk artifact ingestion from files |

### Repository & Git

| Function | Purpose |
|----------|---------|
| `sync-repo-push` | Push commits to GitHub |
| `sync-repo-pull` | Pull from GitHub |
| `create-empty-repo` | Create empty repository |
| `create-repo-from-template` | Clone from GitHub template |
| `clone-public-repo` | Clone any public repository |
| `link-existing-repo` | Link existing GitHub repo |
| `staging-operations` | Stage/unstage/commit workflow |

### Database Management

| Function | Purpose |
|----------|---------|
| `manage-database` | Schema browsing, SQL execution, data export |
| `render-database` | Render.com PostgreSQL provisioning |
| `database-agent-import` | AI-powered schema inference for imports |
| `database-connection-secrets` | Secure connection string encryption |

### Deployment

| Function | Purpose |
|----------|---------|
| `render-service` | Render.com web service management |
| `deployment-secrets` | Deployment environment variable storage |
| `generate-local-package` | Local development package generation |
| `report-local-issue` | Local testing log capture and reporting |

### Presentation

| Function | Purpose |
|----------|---------|
| `presentation-agent` | Blackboard-based slide generation |
| `recast-slide-layout` | Slide layout restructuring with AI |

### Admin & Auth

| Function | Purpose |
|----------|---------|
| `admin-management` | Admin role management |
| `send-auth-email` | Custom auth emails via Resend |
| `superadmin-github-management` | GitHub organization management |
| `superadmin-render-management` | Render.com organization management |

### Edge Function Pattern

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, shareToken, ...params } = await req.json();
    
    // Create Supabase client with auth header
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    );
    
    // Validate access via RPC
    const { data: role, error: authError } = await supabase.rpc(
      'authorize_project_access',
      { p_project_id: projectId, p_token: shareToken || null }
    );
    
    if (authError || !role) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Perform operation...
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

---

## Real-Time Subscriptions

Pronghorn uses Supabase Realtime for live collaboration.

### Subscription Pattern

```typescript
import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeCanvas(projectId: string, shareToken: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    // Subscribe to changes
    channelRef.current = supabase
      .channel(`canvas:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvas_nodes',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          // Handle INSERT, UPDATE, DELETE
          if (payload.eventType === 'INSERT') {
            setNodes(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setNodes(prev => prev.map(n => 
              n.id === payload.new.id ? payload.new : n
            ));
          } else if (payload.eventType === 'DELETE') {
            setNodes(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .on('broadcast', { event: 'canvas_refresh' }, () => {
        // Reload all data on broadcast
        loadCanvasData();
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [projectId]);

  // Broadcast changes to other clients
  const broadcastRefresh = () => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'canvas_refresh',
      payload: {}
    });
  };

  return { nodes, broadcastRefresh };
}
```

### Key Patterns

1. **Use `useRef` for channel storage** - Prevents stale closures
2. **Store channel during subscription** - Required for broadcasting
3. **Use `channelRef.current.send()`** - Not `supabase.channel().send()`
4. **Clean up on unmount** - Unsubscribe and null the ref

### Security Model

Pronghorn's real-time subscriptions use two distinct security models:

#### 1. `postgres_changes` Events (RLS-Protected)

Database change events are **fully secured** by Row Level Security (RLS):

| Security Layer | Description |
|----------------|-------------|
| **Token Validation** | `set_share_token()` RPC call configures session context |
| **RLS Policies** | All tables have policies that check `app.share_token` |
| **Server-Side Filtering** | Supabase only sends events the client is authorized to see |

```typescript
// Before subscribing, the token is set in the session
await supabase.rpc('set_share_token', { token: shareToken });

// postgres_changes events respect RLS - unauthorized clients receive nothing
.on('postgres_changes', { 
  event: '*', 
  schema: 'public', 
  table: 'canvas_nodes',
  filter: `project_id=eq.${projectId}`  // Server enforces this + RLS
}, handleChange)
```

**Security Guarantee**: A client with only the `projectId` but no valid `share_token` cannot receive `postgres_changes` events.

#### 2. Broadcast Events (Public Channels)

Broadcast channels are intentionally **not private**:

| Aspect | Status |
|--------|--------|
| **Channel Privacy** | Public (no `private: true` flag) |
| **Data Sensitivity** | **None** - broadcasts carry only refresh signals |
| **Actual Data Access** | Still requires valid token via RPC calls |

```typescript
// Broadcast sends NO sensitive data - just a refresh signal
channelRef.current?.send({
  type: 'broadcast',
  event: 'canvas_refresh',
  payload: {}  // Empty payload - no data exposed
});

// Client must still call RPC with valid token to get actual data
const { data } = await supabase.rpc('get_canvas_nodes_with_token', {
  p_project_id: projectId,
  p_token: shareToken  // Token validated server-side
});
```

**Security Analysis**:
- Someone knowing only the `projectId` could technically subscribe to broadcast channels
- However, they would only receive "refresh" signals with empty payloads
- All actual data fetching requires a valid `share_token` validated by RLS
- **Risk Assessment**: Minimal - no data leakage occurs

#### Summary: Defense in Depth

```
┌─────────────────────────────────────────────────────────────────┐
│                    Real-Time Security Layers                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ postgres_changes                                         │    │
│  │ ✅ RLS-protected via share_token                        │    │
│  │ ✅ Server-side filtering                                │    │
│  │ ✅ No unauthorized data access possible                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Broadcast Events                                         │    │
│  │ ⚠️  Public channels (by design)                         │    │
│  │ ✅ Zero sensitive data in payloads                      │    │
│  │ ✅ Data fetching still requires valid token             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Data Access (RPC Functions)                              │    │
│  │ ✅ All *_with_token functions validate share_token      │    │
│  │ ✅ SECURITY DEFINER with controlled search_path         │    │
│  │ ✅ Role-based permission checks                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/pronghorn-red/pronghorn.git
cd pronghorn

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment

The Supabase configuration is embedded in the client. No `.env` file is required for the frontend.

For edge functions, the following secrets are configured in Supabase:

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | Google Gemini API access |
| `ANTHROPIC_API_KEY` | Anthropic Claude API access |
| `GROK_API_KEY` | xAI Grok API access |
| `GITHUB_PAT` | Default repository operations |
| `RENDER_API_KEY` | Render.com deployments & databases |
| `RENDER_OWNER_ID` | Render.com account ID |
| `RESEND_API_KEY` | Custom email delivery |

### Database Tables

Key tables for database management:

| Table | Purpose |
|-------|---------|
| `project_databases` | Render.com hosted PostgreSQL instances |
| `project_database_connections` | External database connections |
| `project_database_sql` | Saved SQL queries per database |
| `project_migrations` | DDL migration history tracking |
| `project_tokens` | Project access tokens with roles |

---

## Deployment

### Frontend

The frontend is hosted on Lovable at [https://pronghorn.red](https://pronghorn.red).

To deploy updates:
1. Push changes to the repository
2. Lovable automatically builds and deploys

### Backend (Edge Functions)

Edge functions deploy automatically when code is pushed. No manual deployment required.

### Render.com (Optional)

For application deployments, Pronghorn supports Render.com:

| Environment | URL Pattern |
|-------------|-------------|
| Development | `dev-{appname}.onrender.com` |
| Staging | `uat-{appname}.onrender.com` |
| Production | `prod-{appname}.onrender.com` |

### Supported Runtimes

| Runtime | Description |
|---------|-------------|
| Node.js | React, Vue, Express backends |
| Python | Flask, FastAPI, Django |
| Go | Compiled Go applications |
| Ruby | Rails, Sinatra applications |
| Rust | Compiled Rust binaries |
| Elixir | Phoenix applications |
| Docker | Custom Dockerfile deployments |

### Local Development Package

Generate a local development package for testing:

```bash
# Download package from Deploy page
# Extract and run:
npm install
npm start
```

The package includes:
- `pronghorn-runner.js` - Watches files and auto-rebuilds
- Telemetry integration with pronghorn.red
- Environment configuration

---

## Legal

### Alpha Notice

This application is currently in Alpha testing by the **Government of Alberta**. Features, functionality, and availability are subject to change or may be removed at any time during the testing period.

### Liability Waiver

By using this application, you acknowledge that it is provided "as is" without any warranties, express or implied. The Government of Alberta assumes no liability for any issues, data loss, or damages that may result from using this application during the testing period.

### License

MIT License - See [LICENSE](./LICENSE) for details.

---

## Contact

**Government of Alberta**  
Ministry of Technology and Innovation

- **Website**: [https://pronghorn.red](https://pronghorn.red)
- **Repository**: [GitHub](https://github.com/pronghorn-red/pronghorn)
