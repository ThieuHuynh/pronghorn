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

The platform operates in three modes:
1. **Design Mode**: Visual specification building with React Flow canvas
2. **Audit Mode**: Continuous validation against standards
3. **Build Mode**: Autonomous code generation with real-time monitoring

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

### 🤖 Multi-Agent AI Teams
Orchestrated AI specialists working together:
- **Architect Agent**: Designs system structure
- **Developer Agent**: Implements components
- **DBA Agent**: Designs database schemas
- **Security Agent**: Reviews for vulnerabilities
- **QA Agent**: Validates against requirements

Agents share a blackboard for iterative refinement across multiple epochs.

### 💻 AI Coding Agent
Autonomous file operations with full Git workflow:
- Read, edit, create, delete, rename files
- Staging → Commit → Push workflow
- Real-time progress monitoring
- Support for pause/resume and abort operations

### ⚡ Instant Collaboration
No-login-required sharing:
- Token-based project access
- Anonymous project creation with session persistence
- Real-time Supabase subscriptions for live updates

---

## Database Management

Pronghorn provides full PostgreSQL database lifecycle management with AI-powered data import.

### 🗄️ Provision & Connect

| Feature | Description |
|---------|-------------|
| **One-Click Provisioning** | Create PostgreSQL databases via Render.com with automatic configuration |
| **External Connections** | Connect to any PostgreSQL instance with secure connection string storage |
| **SSL Configuration** | Support for `require`, `prefer`, `disable` SSL modes |
| **Status Tracking** | Real-time database status (pending, creating, available, error, suspended) |
| **Connection Testing** | Verify connectivity before saving external connections |

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

### 📋 Migration Tracking

Automatic DDL statement history:
- **CREATE** - Tables, views, functions, indexes
- **ALTER** - Column additions, type changes, constraints
- **DROP** - Tracked for audit trail
- **Object Metadata** - Schema, name, type for each migration
- **Execution Log** - Timestamp, user, and full SQL content

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

### Backend (Supabase)

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Row Level Security** | Token-based access control |
| **Edge Functions** | Deno serverless functions |
| **Realtime** | WebSocket subscriptions |
| **Storage** | File and artifact storage |

### LLM Providers

| Provider | Models |
|----------|--------|
| **Google Gemini** | gemini-2.5-flash, gemini-2.5-pro |
| **Anthropic Claude** | claude-opus-4-5 |
| **xAI Grok** | grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning |

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
│   │   │   └── ...
│   │   ├── build/                 # Coding agent interface
│   │   │   ├── UnifiedAgentInterface.tsx
│   │   │   ├── AgentProgressMonitor.tsx
│   │   │   ├── StagingPanel.tsx
│   │   │   └── ...
│   │   ├── deploy/                # Database & deployment components
│   │   │   ├── DatabaseExplorer.tsx      # Schema browser & SQL editor
│   │   │   ├── DatabaseImportWizard.tsx  # Multi-step data import
│   │   │   ├── SqlQueryEditor.tsx        # Monaco SQL editor
│   │   │   ├── ConnectDatabaseDialog.tsx # External DB connections
│   │   │   ├── import/                   # Import wizard sub-components
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   ├── ExcelDataGrid.tsx
│   │   │   │   ├── SchemaCreator.tsx
│   │   │   │   └── SqlReviewPanel.tsx
│   │   │   └── ...
│   │   ├── repository/            # File tree, editor, Git integration
│   │   │   ├── FileTree.tsx
│   │   │   ├── CodeEditor.tsx
│   │   │   └── ...
│   │   ├── requirements/          # Requirements tree management
│   │   ├── standards/             # Standards library UI
│   │   ├── dashboard/             # Project cards, creation dialogs
│   │   ├── layout/                # Navigation, sidebar, header
│   │   └── project/               # Project-specific selectors
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Authentication state & methods
│   │   └── AdminContext.tsx       # Admin mode management
│   │
│   ├── hooks/
│   │   ├── useShareToken.ts       # Token extraction & caching
│   │   ├── useRealtimeCanvas.ts   # Canvas real-time sync
│   │   ├── useRealtimeRequirements.ts
│   │   ├── useRealtimeArtifacts.ts
│   │   ├── useRealtimeLayers.ts
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Landing.tsx            # Marketing landing page
│   │   ├── Dashboard.tsx          # Project list
│   │   ├── Auth.tsx               # Login/signup/SSO
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
│   │       ├── Audit.tsx
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
│   │   └── utils.ts               # Utility functions
│   │
│   └── main.tsx                   # Application entry point
│
├── supabase/
│   ├── functions/                 # 25+ Deno edge functions
│   │   ├── create-project/
│   │   ├── coding-agent-orchestrator/
│   │   ├── orchestrate-agents/
│   │   ├── decompose-requirements/
│   │   ├── sync-repo-push/
│   │   ├── sync-repo-pull/
│   │   ├── chat-stream-gemini/
│   │   ├── chat-stream-anthropic/
│   │   ├── chat-stream-xai/
│   │   ├── ai-architect/
│   │   ├── ai-architect-critic/
│   │   └── ...
│   └── config.toml                # Supabase configuration
│
├── public/
│   └── data/
│       ├── agents.json            # Multi-agent definitions
│       ├── buildAgents.json       # Coding agent config
│       ├── connectionLogic.json   # Canvas edge rules
│       └── graphicStyles.json     # Canvas styling
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

Pronghorn includes 25+ Deno edge functions for server-side operations.

### Function Categories

#### Project Management
| Function | Purpose |
|----------|---------|
| `create-project` | Project creation with token generation |
| `generate-specification` | Generate project specification documents |

#### Requirements Processing
| Function | Purpose |
|----------|---------|
| `decompose-requirements` | AI decomposition into Epics/Features/Stories |
| `expand-requirement` | Expand single requirement with AI |
| `expand-standards` | Generate standards from descriptions |

#### AI Agents
| Function | Purpose |
|----------|---------|
| `orchestrate-agents` | Multi-agent canvas design iteration |
| `ai-architect` | Architecture generation |
| `ai-architect-critic` | Architecture review and critique |
| `coding-agent-orchestrator` | Autonomous coding agent |

#### Chat & Streaming
| Function | Purpose |
|----------|---------|
| `chat-stream-gemini` | Gemini streaming chat |
| `chat-stream-anthropic` | Claude streaming chat |
| `chat-stream-xai` | Grok streaming chat |
| `summarize-chat` | Generate chat summaries |
| `summarize-artifact` | Generate artifact summaries |

#### Repository & Git
| Function | Purpose |
|----------|---------|
| `sync-repo-push` | Push commits to GitHub |
| `sync-repo-pull` | Pull from GitHub |
| `create-empty-repo` | Create empty repository |
| `create-repo-from-template` | Clone from template |
| `clone-public-repo` | Clone public repository |
| `link-existing-repo` | Link existing GitHub repo |

#### Deployment
| Function | Purpose |
|----------|---------|
| `render-service` | Render.com service management |
| `generate-local-package` | Local development package |

#### Database Management
| Function | Purpose |
|----------|---------|
| `manage-database` | Schema browsing, SQL execution, data export |
| `render-database` | Render.com PostgreSQL provisioning |
| `database-agent-import` | AI-powered schema inference for imports |

#### Media
| Function | Purpose |
|----------|---------|
| `generate-image` | AI image generation |
| `upload-artifact-image` | Image upload handling |

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

#### Why Not Use Private Channels?

Supabase's private channel feature requires:
1. RLS policies on `realtime.messages` table
2. JWT-based authentication via `supabase.realtime.setAuth()`
3. Authenticated users (not anonymous/token-based access)

Our token-based RBAC system is incompatible with Supabase's private channel authorization model. Since broadcasts carry no sensitive data, the current architecture is secure without requiring private channels.

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

### Database Tables

Key tables for database management:

| Table | Purpose |
|-------|---------|
| `project_databases` | Render.com hosted PostgreSQL instances |
| `project_database_connections` | External database connections |
| `project_database_sql` | Saved SQL queries per database |
| `project_migrations` | DDL migration history tracking |

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

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE GOVERNMENT OF ALBERTA, ITS MINISTERS, OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### Third-Party Services

Pronghorn integrates with the following third-party services:

| Service | Terms |
|---------|-------|
| [Lovable](https://lovable.dev) | [Terms of Service](https://lovable.dev/terms) |
| [Supabase](https://supabase.com) | [Terms of Service](https://supabase.com/terms) |
| [Google Cloud](https://cloud.google.com) | [Terms of Service](https://cloud.google.com/terms) |
| [Microsoft Azure](https://azure.microsoft.com) | [Terms of Service](https://azure.microsoft.com/en-us/support/legal/) |
| [GitHub](https://github.com) | [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) |
| [Render.com](https://render.com) | [Terms of Service](https://render.com/terms) |

### Full Legal Documents

- [Terms of Use](https://pronghorn.red/terms)
- [Privacy Policy](https://pronghorn.red/privacy)

---

## Contact

**Government of Alberta**  
Ministry of Technology and Innovation

📧 Email: [ti.deputyminister@gov.ab.ca](mailto:ti.deputyminister@gov.ab.ca)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ by the Government of Alberta</strong>
</p>
