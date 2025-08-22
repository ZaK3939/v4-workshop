import { useState, useEffect } from "react";
import { graphqlClient } from "@/lib/graphql";
import { gql } from "graphql-request";

const HOOK_POOLS_QUERY = gql`
  query HookPools {
    Pool(
      where: { 
        hooks: { _neq: "0x0000000000000000000000000000000000000000" }
      }
      order_by: { totalValueLockedUSD: desc }
      limit: 1000
    ) {
      id
      name
      hooks
      token0
      token1
      feeTier
      totalValueLockedUSD
      volumeUSD
      feesUSD
      txCount
      createdAtTimestamp
    }
  }
`;

interface HookPool {
  id: string;
  name: string;
  hooks: string;
  token0: string;
  token1: string;
  feeTier: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  feesUSD: string;
  txCount: string;
  createdAtTimestamp: string;
}

interface HookPoolsData {
  Pool: HookPool[];
}

export function useHookPools() {
  const [data, setData] = useState<HookPoolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await graphqlClient.request<HookPoolsData>(HOOK_POOLS_QUERY);
        setData(result);
        setError(null);
      } catch (err) {
        console.error("Error fetching hook pools:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch hook pools");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const pools = data?.Pool || [];
  const totalCount = pools.length;
  
  // If we're getting exactly 1000 pools, we might be hitting the limit
  const mightHaveMore = totalCount === 1000;

  return { 
    pools, 
    totalCount,
    mightHaveMore,
    loading, 
    error 
  };
}