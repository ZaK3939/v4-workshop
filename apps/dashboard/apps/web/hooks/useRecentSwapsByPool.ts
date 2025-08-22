import { useEffect, useState, useRef } from "react";
import { graphqlClient, RECENT_SWAPS_BY_POOL_QUERY } from "@/lib/graphql";

interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: string;
}

interface Swap {
  id: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  origin: string;
  sender: string;
  timestamp: string;
  transaction: string;
  token0: Token;
  token1: Token;
  sqrtPriceX96: string;
  tick: string;
  chainId: string;
}

interface RecentSwapsResponse {
  Swap: Swap[];
}

// Helper function to extract chain ID from the new format
const extractChainId = (id: string): string => {
  // If the ID contains an underscore, extract the part before it
  if (id.includes("_")) {
    const chainId = id.split("_")[0];
    return chainId || id; // Fallback to original id if split fails
  }
  return id;
};

// Helper function to extract pool address from the ID
const extractPoolAddress = (id: string): string => {
  // If the ID contains an underscore, extract the part after it
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

export function useRecentSwapsByPool(
  poolId: string | null,
  limit: number = 100
) {
  const [swaps, setSwaps] = useState<RecentSwapsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!poolId) {
      setSwaps(null);
      return;
    }

    let abortController = new AbortController();

    const fetchData = async () => {
      // Don't fetch if already fetching
      if (fetchingRef.current) return;
      
      fetchingRef.current = true;
      setLoading(true);
      try {
        const data = await graphqlClient.request<RecentSwapsResponse>(
          RECENT_SWAPS_BY_POOL_QUERY,
          {
            poolId,
            limit,
          }
        );
        
        if (!abortController.signal.aborted) {
          setSwaps(data);
          setError(null);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("Error fetching recent swaps:", err);
          setError("Failed to fetch recent swaps for this pool");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          fetchingRef.current = false;
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
      fetchingRef.current = false;
    };
  }, [poolId, limit]);

  return { swaps, loading, error };
}
