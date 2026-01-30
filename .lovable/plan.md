
## Plan: Stop Automatic Refreshing That Resets Deployment Configuration Dialog

### Problem Summary

The Cloud Deployments view is auto-refreshing every few seconds, causing the Deployment Configuration dialog to lose user input. The refreshing occurs through multiple mechanisms:

| Source | Trigger | Result |
|--------|---------|--------|
| `DeploymentCard.tsx` lines 82-98 | 10-second interval during "building"/"deploying" status | Calls `onUpdate()` → parent refreshes |
| `useRealtimeDeployments.ts` lines 145-157 | Supabase realtime `postgres_changes` subscription | Calls `loadDeployments()` on ANY database change |
| Realtime broadcast | Any client triggering `broadcastRefresh()` | Calls `loadDeployments()` |

### Root Cause

When the `render-service` edge function is called for status sync, it updates the `project_deployments` table. This triggers the Supabase realtime subscription, which reloads all deployments. Even though `mergeDeployments()` tries to preserve object references, the cascading updates cause React to re-render components, potentially resetting dialog state.

---

### Solution

Remove automatic refreshing completely. Refreshes should ONLY occur:
1. **Initial page load** - when the Deploy page mounts
2. **User clicks Refresh button** - the button at the top of the page
3. **User clicks "Sync status from Render" button** - the small refresh icon on each card

---

### Implementation

#### 1. Remove Auto-Refresh Interval from DeploymentCard

**File: `src/components/deploy/DeploymentCard.tsx`**

Remove the entire auto-refresh mechanism (lines 51-98):

| Lines | Change |
|-------|--------|
| 51 | Remove `autoRefreshRef` |
| 55-56 | Remove `isTransitionalStatus` constant |
| 58-80 | Keep `syncStatus` but only for manual button use |
| 82-98 | **DELETE** the entire `useEffect` that sets up the interval |

The `syncStatus` function will still exist for the manual "Sync status from Render" button (line 129: `handleSyncStatus`), but no automatic calling.

#### 2. Remove Realtime Subscription from useRealtimeDeployments

**File: `src/hooks/useRealtimeDeployments.ts`**

Remove the Supabase realtime channel completely. The hook will:
- Load deployments on initial mount only
- Provide `refresh` function for manual refresh
- NOT listen to database changes automatically

| Lines | Change |
|-------|--------|
| 15-16 | Remove `channelRef` and `deploymentsRef` (keep `deploymentsRef` if still needed for `refreshFromRender`) |
| 140-168 | Replace the `useEffect` that sets up the channel - only keep `loadDeployments()` on initial mount |

---

### Technical Details

#### DeploymentCard.tsx Changes

```typescript
// REMOVE these lines entirely:
const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

// Check if status is transitional (should auto-refresh)
const isTransitionalStatus = deployment.status === "building" || deployment.status === "deploying";

// Setup auto-refresh when status is transitional
useEffect(() => {
  if (isTransitionalStatus && deployment.render_service_id) {
    autoRefreshRef.current = setInterval(syncStatus, 10000);
  } else {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
  }

  return () => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }
  };
}, [isTransitionalStatus, deployment.render_service_id, syncStatus]);
```

Keep `syncStatus` for the manual button but remove the auto-invocation.

#### useRealtimeDeployments.ts Changes

```typescript
// BEFORE: Complex realtime subscription
useEffect(() => {
  loadDeployments();

  if (!projectId || !enabled) return;

  const channel = supabase
    .channel(`deployments-${projectId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "project_deployments", filter: `project_id=eq.${projectId}` },
      () => loadDeployments()
    )
    .on("broadcast", { event: "deployment_refresh" }, () => loadDeployments())
    .subscribe();

  channelRef.current = channel;

  return () => { ... };
}, [...]);

// AFTER: Simple initial load only
useEffect(() => {
  loadDeployments();
}, [loadDeployments]);
```

Remove `channelRef` since broadcast is no longer needed. Keep `deploymentsRef` as it's used by `refreshFromRender`.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/deploy/DeploymentCard.tsx` | Remove auto-refresh interval, keep manual sync button |
| `src/hooks/useRealtimeDeployments.ts` | Remove realtime subscription, keep only initial load |

---

### User Experience After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Open Deployment Config, wait 10 seconds | Dialog resets/closes | Dialog stays open |
| Deployment in "building" status | Auto-refreshes every 10s | User clicks Refresh manually |
| Another user triggers deploy | Auto-refreshes via realtime | No change until manual refresh |
| User clicks Refresh button | Refreshes | Refreshes (unchanged) |
| User clicks sync icon on card | Syncs that card | Syncs that card (unchanged) |

---

### Note on Broadcast

The `broadcastRefresh` function becomes a no-op since there's no channel to broadcast on. This is intentional - we're removing ALL automatic refreshing to preserve user workflow stability.
