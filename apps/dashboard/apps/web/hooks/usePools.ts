import { useEffect, useState, useRef } from "react";
import { graphqlClient, POOLS_QUERY } from "@/lib/graphql";

interface Token {
  id: string;
  symbol: string;
  name: string;
}

interface Pool {
  chainId: string;
  hooks: string;
  id: string;
  name: string;
  txCount: string;
  token0: string;
  token1: string;
  volumeUSD: string;
  untrackedVolumeUSD: string;
  feesUSD: string;
  feesUSDUntracked: string;
  totalValueLockedUSD: string;
  feeTier?: string;
  tickSpacing?: string;
}

interface PoolsResponse {
  Pool: Pool[];
}

export function usePools() {
  const [pools, setPools] = useState<PoolsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoadRef = useRef<boolean>(true);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  // Function to clear any existing retry timeout
  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await graphqlClient.request<PoolsResponse>(POOLS_QUERY);
        console.log("data", data);
        setPools(data);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on success
        isFirstLoadRef.current = false;
      } catch (err) {
        console.error("Error fetching pools:", err);

        // Only show error if we've already loaded data once or if we've exceeded max retries
        if (!isFirstLoadRef.current || retryCountRef.current >= MAX_RETRIES) {
          setError("Failed to fetch data. Please refresh the page.");
        }

        // If this is the first load or we haven't exceeded max retries, try again
        if (isFirstLoadRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          clearRetryTimeout();
          retryTimeoutRef.current = setTimeout(fetchData, RETRY_DELAY);
          return; // Don't set loading to false yet
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up visibility change listener to refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Clear any existing error when the tab becomes visible again
        if (error) {
          setError(null);
          fetchData();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Poll every second
    const interval = setInterval(fetchData, 1000);

    return () => {
      clearInterval(interval);
      clearRetryTimeout();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [error]);

  return { pools, loading, error };
}
