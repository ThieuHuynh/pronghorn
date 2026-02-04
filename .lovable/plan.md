
# Fix: Include Full Standards Content in Coding Agent

## Problem Summary

When users attach standards via the ProjectSelector to the Coding Agent (Build page), the agent only receives metadata (code, title, truncated description), **not** the actual markdown file content stored in the `content` and `long_description` columns.

This explains why:
- **Claude Console**: Users manually paste full markdown files → Agent sees everything
- **Pronghorn Chat**: Sends entire `attachedContext` as JSON → Agent sees `content` field
- **Pronghorn Build**: Coding agent summarizes context → Agent only sees metadata preview

### Current Behavior (Lines 670-681 in coding-agent-orchestrator)
```typescript
if (projectContext.standards?.length > 0) {
  const stds = projectContext.standards as any[];
  const preview = stds
    .slice(0, 10)
    .map((s) => {
      const code = s.code ? `${s.code} - ` : "";
      const desc = s.description ? String(s.description).slice(0, 160) : "";
      return `- ${code}${s.title}: ${desc}`;
    })
    .join("\n");
  parts.push(`Standards (${stds.length} total, showing up to 10):\n${preview}`);
}
```

**Issues:**
1. Only shows first 10 standards
2. Only uses `code`, `title`, and `description` (truncated to 160 chars)
3. Completely ignores `content` (the actual markdown documentation)
4. Completely ignores `long_description` (extended documentation)

---

## Solution

Update the standards handling in `coding-agent-orchestrator` to include the full content, similar to how Repository Files are handled:

### File to Modify
`supabase/functions/coding-agent-orchestrator/index.ts`

### Changes

Replace the standards handling block (lines 670-681) with logic that:

1. Includes **all** selected standards (no `.slice(0, 10)` limit)
2. Formats each standard with:
   - Header: `### STANDARD: {code} - {title}`
   - Description (if present)
   - Full `content` field (the main markdown documentation)
   - Full `long_description` field (if present and different from content)
3. Uses same formatting pattern as repository files for consistency

### New Implementation

```typescript
if (projectContext.standards?.length > 0) {
  const stds = projectContext.standards as any[];
  const allStandardsContent = stds.map((s: any) => {
    const code = s.code || 'STD';
    const title = s.title || 'Untitled Standard';
    let standardStr = `### STANDARD: ${code} - ${title}`;
    
    if (s.description) {
      standardStr += `\n**Description:** ${s.description}`;
    }
    
    // Include main content (the markdown file content)
    if (s.content) {
      standardStr += `\n\n**Content:**\n${s.content}`;
    }
    
    // Include long_description if present and different from content
    if (s.long_description && s.long_description !== s.content) {
      standardStr += `\n\n**Extended Documentation:**\n${s.long_description}`;
    }
    
    return standardStr;
  }).join("\n\n---\n\n");
  
  parts.push(`Standards (${stds.length} attached by user - FULL CONTENT):\n\n${allStandardsContent}`);
}
```

---

## Tech Stacks Consideration

The same issue exists for Tech Stacks (lines 683-694). They also have `long_description` fields that are being ignored. The fix should apply the same pattern:

### Current Tech Stacks Handling
```typescript
if (projectContext.techStacks?.length > 0) {
  const stacks = projectContext.techStacks as any[];
  const preview = stacks
    .slice(0, 10)
    .map((t) => {
      const type = t.type ? ` [${t.type}]` : "";
      const desc = t.description ? String(t.description).slice(0, 120) : "";
      return `- ${t.name}${type}: ${desc}`;
    })
    .join("\n");
  parts.push(`Tech Stacks (${stacks.length} total, showing up to 10):\n${preview}`);
}
```

### New Tech Stacks Handling
```typescript
if (projectContext.techStacks?.length > 0) {
  const stacks = projectContext.techStacks as any[];
  const allStacksContent = stacks.map((t: any) => {
    const type = t.type ? ` [${t.type}]` : "";
    const version = t.version ? ` v${t.version}` : "";
    let stackStr = `### TECH STACK: ${t.name}${type}${version}`;
    
    if (t.description) {
      stackStr += `\n**Description:** ${t.description}`;
    }
    
    if (t.long_description) {
      stackStr += `\n\n**Documentation:**\n${t.long_description}`;
    }
    
    return stackStr;
  }).join("\n\n---\n\n");
  
  parts.push(`Tech Stacks (${stacks.length} attached by user - FULL CONTENT):\n\n${allStacksContent}`);
}
```

---

## Implementation Steps

| Step | Action |
|------|--------|
| 1 | Edit `supabase/functions/coding-agent-orchestrator/index.ts` |
| 2 | Replace lines 670-681 (standards handling) with new implementation |
| 3 | Replace lines 683-694 (tech stacks handling) with new implementation |
| 4 | Deploy the edge function |
| 5 | Test by attaching Alberta Design System standards in Build and verifying full content appears in agent context |

---

## Expected Outcome

After this fix:
- Coding Agent will receive the **full markdown content** from attached standards
- The agent will be able to generate code that strictly complies with the design system documentation
- Results will match what users see in Claude Console and Pronghorn Chat
