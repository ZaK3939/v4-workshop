import { useEffect, useState } from "react";
import { graphqlClient, POOLS_BY_HOOK_QUERY } from "../lib/graphql";

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
  createdAtTimestamp: string;
}

interface PoolsByHookResponse {
  Pool: Pool[];
}

export function usePoolsByHook(
  hookAddress: string | null,
  chainId: string | null
) {
  const [pools, setPools] = useState<PoolsByHookResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hookAddress || !chainId) {
      setPools(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const numericChainId = parseInt(chainId);
        if (isNaN(numericChainId)) {
          throw new Error("Invalid chain ID");
        }

        const data = await graphqlClient.request<PoolsByHookResponse>(
          POOLS_BY_HOOK_QUERY,
          { hookAddress, chainId: numericChainId }
        );
        setPools(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching pools by hook:", err);
        setError("Failed to fetch pools for this hook");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hookAddress, chainId]);

  return { pools, loading, error };
}
