import { useState, useEffect } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "@/lib/graphql";

const HOOKS_QUERY = gql`
  query HooksList {
    Pool(
      where: { 
        hooks: { _neq: "0x0000000000000000000000000000000000000000" }
      }
    ) {
      id
      name
      hooks
      feeTier
      totalValueLockedUSD
      volumeUSD
      feesUSD
      token0
      token1
      txCount
      createdAtTimestamp
    }
  }
`;

interface Pool {
  id: string;
  name: string;
  hooks: string;
  feeTier: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  feesUSD: string;
  token0: string;
  token1: string;
  txCount: string;
  createdAtTimestamp: string;
}

interface HookData {
  address: string;
  poolCount: number;
  totalValueLockedUSD: number;
  totalVolumeUSD: number;
  totalFeesUSD: number;
  pools: Pool[];
}

interface UseHooksResult {
  hooks: HookData[];
  loading: boolean;
  error: string | null;
}

export function useHooks(): UseHooksResult {
  const [hooks, setHooks] = useState<HookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHooks = async () => {
      try {
        const response = await graphqlClient.request<{ Pool: Pool[] }>(HOOKS_QUERY);
        
        // Group pools by hook address
        const hookMap = new Map<string, HookData>();
        
        response.Pool.forEach(pool => {
          const hookAddress = pool.hooks.toLowerCase();
          
          if (!hookMap.has(hookAddress)) {
            hookMap.set(hookAddress, {
              address: pool.hooks,
              poolCount: 0,
              totalValueLockedUSD: 0,
              totalVolumeUSD: 0,
              totalFeesUSD: 0,
              pools: []
            });
          }
          
          const hookData = hookMap.get(hookAddress)!;
          hookData.poolCount++;
          hookData.totalValueLockedUSD += parseFloat(pool.totalValueLockedUSD || "0");
          hookData.totalVolumeUSD += parseFloat(pool.volumeUSD || "0");
          hookData.totalFeesUSD += parseFloat(pool.feesUSD || "0");
          hookData.pools.push(pool);
        });
        
        // Convert map to array and sort by TVL
        const hooksArray = Array.from(hookMap.values())
          .sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
        
        setHooks(hooksArray);
        setError(null);
      } catch (err) {
        console.error("Error fetching hooks:", err);
        setError("Failed to fetch hooks data");
      } finally {
        setLoading(false);
      }
    };

    fetchHooks();
    const interval = setInterval(fetchHooks, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return { hooks, loading, error };
}