

## Plan: Fix Contradictory Prompt Rules Causing Slow Agent

### Problem Identified

The agent is slow because of **contradictory instructions** in the prompt template:

| Section | Order | Rule | Conflict |
|---------|-------|------|----------|
| `critical_rules` | 4 | "MANDATORY: Call read_file BEFORE edit_lines" | **Causes read before EVERY edit** |
| `operation_batching` | 8 | "AFTER EDITING, DO NOT RE-READ" | Ignored - lower priority |
| `edit_safety` | 8.5 | "You do NOT need to read_file again after editing" | Ignored - lower priority |

The agent follows the **higher-priority** `critical_rules` (order 4), which mandates reading before every edit, causing:
- One edit per iteration
- Redundant file reads
- Extremely slow performance

### Solution

Update `critical_rules` to clarify that `read_file` is only needed for **first access**, not every edit. The `fresh_content` from edits provides updated line numbers.

---

### Implementation

**File: `public/data/codingAgentPromptTemplate.json`**

Update the `critical_rules` content (line 50) to replace the conflicting rule 5:

**Current (causing slowness):**
```
EDITING:
4. ALWAYS use edit_lines for targeted changes - preserves git blame, cleaner diffs
5. MANDATORY: Call read_file BEFORE edit_lines to see current content and line numbers
6. Prefer "path" over "file_id" for operations - system resolves paths automatically
7. After edit_lines, check the verification object to confirm your edit worked
```

**Updated (efficient):**
```
EDITING:
4. ALWAYS use edit_lines for targeted changes - preserves git blame, cleaner diffs
5. Call read_file BEFORE editing a file for the FIRST TIME this session
6. AFTER edit_lines, use the 'fresh_content' from the result - DO NOT re-read the same file
7. Prefer "path" over "file_id" for operations - system resolves paths automatically
8. After edit_lines, check the verification object to confirm your edit worked
```

Also update the WORKFLOW section to renumber and add batching emphasis:

**Updated WORKFLOW:**
```
WORKFLOW:
9. Work autonomously - chain operations, DO NOT stop after a single operation
10. BATCH AGGRESSIVELY: Include 5-20 operations per response - single-operation responses are wasteful
11. ALWAYS include a blackboard_entry in EVERY response (required)
12. Before status='completed', call get_staged_changes to verify your changes

STATUS VALUES:
13. "in_progress" - need more operations
14. "completed" - ONLY after exhaustive validation
```

---

### Technical Details

The full updated `content` value for `critical_rules` section:

```
=== CRITICAL RULES ===

Here are your standard operating procedures:

DISCOVERY:
1. If user attached files, use read_file directly with provided file_ids.
2. If no files attached, start with list_files or wildcard_search to get current file IDs
3. Use wildcard_search when you have concepts/keywords to find

EDITING:
4. ALWAYS use edit_lines for targeted changes - preserves git blame, cleaner diffs
5. Call read_file BEFORE editing a file for the FIRST TIME this session
6. AFTER edit_lines, use the 'fresh_content' from the result - DO NOT re-read the same file
7. Prefer "path" over "file_id" for operations - system resolves paths automatically
8. After edit_lines, check the verification object to confirm your edit worked

WORKFLOW:
9. Work autonomously - chain operations, DO NOT stop after a single operation
10. BATCH AGGRESSIVELY: Include 5-20 operations per response - single-operation responses are wasteful
11. ALWAYS include a blackboard_entry in EVERY response (required)
12. Before status='completed', call get_staged_changes to verify your changes

STATUS VALUES:
13. "in_progress" - need more operations
14. "completed" - ONLY after exhaustive validation
```

---

### Files to Modify

| File | Change |
|------|--------|
| `public/data/codingAgentPromptTemplate.json` | Update `critical_rules` content to fix contradictory read_file instruction and add batching emphasis |

---

### Expected Outcome

| Before | After |
|--------|-------|
| Agent reads file before EVERY edit | Agent reads once per file, uses fresh_content thereafter |
| 1 edit per iteration | 5-20 operations per iteration |
| read → edit → read → edit loop | read A,B,C → edit A,A,A,B,B,C pattern |

