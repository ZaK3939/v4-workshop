import { useState, useEffect } from "react";

interface HookInfo {
  id: string;
  fields: Record<string, any>;
}

export function useHookInfo() {
  const [hookInfo, setHookInfo] = useState<HookInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHookInfo = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/hooks/info");
        if (!response.ok) throw new Error("Failed to fetch hook information");
        const data = await response.json();
        setHookInfo(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching hook info:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred while fetching hook information"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchHookInfo();
  }, []);

  return { hookInfo, isLoading, error };
}
