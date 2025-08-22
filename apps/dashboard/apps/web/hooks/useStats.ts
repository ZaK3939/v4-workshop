import { useEffect, useState, useRef } from "react";
import { graphqlClient, STATS_QUERY } from "@/lib/graphql";

type FactoryStat = {
  numberOfSwaps: string;
  poolCount: string;
  id: string;
  owner: string;
  totalFeesETH: string;
  totalFeesUSD: string;
  totalValueLockedETH: string;
  totalValueLockedETHUntracked: string;
  totalValueLockedUSD: string;
  totalValueLockedUSDUntracked: string;
  totalVolumeETH: string;
  totalVolumeUSD: string;
  untrackedVolumeUSD: string;
};

interface Stats {
  Factory: FactoryStat[];
  PoolManager?: FactoryStat[];
  chain_metadata: {
    chain_id: number;
    latest_fetched_block_number?: number;
    latest_processed_block?: number;
  }[];
}

const INITIAL_RETRY_DELAY = 1000; // Start with 1 second
const MAX_RETRY_DELAY = 30000; // Max 30 seconds
const MAX_RETRIES = 5;

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const currentDelay = useRef(INITIAL_RETRY_DELAY);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoadRef = useRef<boolean>(true);

  // Function to clear any existing timeout
  const clearCurrentTimeout = () => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const data = await graphqlClient.request<Stats>(STATS_QUERY);        
        if (mounted) {
          // Handle both V3 (Factory) and V4 (PoolManager) responses
          const statsData = {
            ...data,
            Factory: data.Factory || data.PoolManager || []
          };
          setStats(statsData);
          setError(null);
          setRetryCount(0);
          currentDelay.current = INITIAL_RETRY_DELAY;
          isFirstLoadRef.current = false;
          clearCurrentTimeout();
          timeoutIdRef.current = setTimeout(fetchData, 1000);
        }
      } catch (err) {
        console.log(err);
        const isRateLimit = err?.toString().includes("429");

        if (isRateLimit && retryCount < MAX_RETRIES) {
          currentDelay.current = Math.min(
            currentDelay.current * 2,
            MAX_RETRY_DELAY
          );
          if (mounted) {
            setError(
              `Rate limit reached. Retrying in ${currentDelay.current / 1000} seconds...`
            );
            clearCurrentTimeout();
            timeoutIdRef.current = setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              fetchData();
            }, currentDelay.current);
          }
        } else {
          if (mounted) {
            // Only show error if we've already loaded data once or if we've exceeded max retries
            if (!isFirstLoadRef.current || retryCount >= MAX_RETRIES) {
              setError(
                isRateLimit
                  ? "Rate limit exceeded. Please try again later."
                  : "Failed to fetch data. Please refresh the page here."
              );
            }

            // If this is the first load and not a rate limit error, try again
            if (
              isFirstLoadRef.current &&
              !isRateLimit &&
              retryCount < MAX_RETRIES
            ) {
              setRetryCount((prev) => prev + 1);
              clearCurrentTimeout();
              timeoutIdRef.current = setTimeout(fetchData, INITIAL_RETRY_DELAY);
            }
          }
        }
      }
    };

    fetchData();

    // Set up visibility change listener to refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Clear any existing error when the tab becomes visible again
        if (error) {
          setError(null);
          setRetryCount(0);
          currentDelay.current = INITIAL_RETRY_DELAY;
          fetchData();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      clearCurrentTimeout();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [error, retryCount]);

  return { stats, error };
}
