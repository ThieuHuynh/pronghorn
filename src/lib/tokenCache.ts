// Module-level cache for share tokens (persists across component renders)
const tokenCache = new Map<string, string>();

export const setProjectToken = (projectId: string, token: string) => {
  tokenCache.set(projectId, token);
};

export const getProjectToken = (projectId: string): string | null => {
  return tokenCache.get(projectId) || null;
};

export const clearProjectToken = (projectId: string) => {
  tokenCache.delete(projectId);
};
