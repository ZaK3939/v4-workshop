import { useState } from "react";
import { useHookPools } from "@/hooks/useHookPools";
import { ExternalLink, Info, TrendingUp, DollarSign, Activity } from "lucide-react";
import { HookPoolsModal } from "./HookPoolsModal";
import { PoolSwapsModal } from "./PoolSwapsModal";

// Helper function to format USD values
const formatUSD = (value: string): string => {
  const num = parseFloat(value);
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
};

// Helper function to shorten address
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to extract pool address from the ID
const extractPoolAddress = (id: string): string => {
  if (!id) return "";
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

// Format fee (3000 = 0.3%)
const formatFee = (feeTier: string): string => {
  const feeNum = parseInt(feeTier);
  
  // Check if this is a dynamic fee pool (has the dynamic fee flag bit set)
  // Dynamic fee flag is 0x800000 (8388608)
  const DYNAMIC_FEE_FLAG = 0x800000;
  if ((feeNum & DYNAMIC_FEE_FLAG) !== 0) {
    return "Dynamic";
  }
  
  return `${(feeNum / 10000).toFixed(2)}%`;
};

interface HookPoolsSummaryProps {
  hookFilter?: string;
}

export function HookPoolsSummary({ hookFilter }: HookPoolsSummaryProps) {
  const { pools, totalCount, mightHaveMore, loading, error } = useHookPools();
  const [selectedPool, setSelectedPool] = useState<any | null>(null);
  const [showAllPools, setShowAllPools] = useState(false);
  const [showSwapsModal, setShowSwapsModal] = useState<{
    poolId: string;
    poolName: string;
    token0: string;
    token1: string;
  } | null>(null);

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load hook pools. Please try again later.
      </div>
    );
  }

  // Filter pools by hook address if filter is provided
  const filteredPools = hookFilter
    ? pools.filter(pool => 
        pool.hooks.toLowerCase().includes(hookFilter.toLowerCase())
      )
    : pools;

  const displayedPools = showAllPools ? filteredPools : filteredPools.slice(0, 10);

  // Calculate totals from filtered pools
  const totalTVL = filteredPools.reduce((acc, pool) => acc + parseFloat(pool.totalValueLockedUSD || "0"), 0);
  const totalVolume = filteredPools.reduce((acc, pool) => acc + parseFloat(pool.volumeUSD || "0"), 0);
  const totalFees = filteredPools.reduce((acc, pool) => acc + parseFloat(pool.feesUSD || "0"), 0);

  return (
    <div className="space-y-6">
      {loading && pools.length === 0 ? (
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-6 bg-secondary/30 rounded w-48 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-secondary/30 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredPools.length === 0 && hookFilter ? (
        <div className="py-10 text-center text-muted-foreground">
          No hook pools found with hook address containing &quot;{hookFilter}&quot;
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Total TVL</span>
          </div>
          <div className="text-2xl font-semibold">{formatUSD(totalTVL.toString())}</div>
        </div>
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Total Volume</span>
          </div>
          <div className="text-2xl font-semibold">{formatUSD(totalVolume.toString())}</div>
        </div>
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Activity className="w-4 h-4" />
            <span>Pools Shown</span>
          </div>
          <div className="text-2xl font-semibold">
            {filteredPools.length}
          </div>
        </div>
      </div>

      {/* Pools Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Top Hook Pools by TVL</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hookFilter 
                ? `Showing ${filteredPools.length} pools with hook address containing "${hookFilter}"`
                : `Showing top ${totalCount} pools with hooks${mightHaveMore && " (limited by query)"}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Click pool for details</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pool</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hook Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fee</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">TVL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Volume 24h</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Swaps</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayedPools.map((pool) => {
                  const poolAddress = extractPoolAddress(pool.id);
                  return (
                    <tr
                      key={pool.id}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedPool(pool)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">
                          {pool.name || `${pool.token0}/${pool.token1}`}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {shortenAddress(poolAddress)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{shortenAddress(pool.hooks)}</span>
                          <a
                            href={`https://hookrank.io/130/${pool.hooks.toLowerCase()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatFee(pool.feeTier)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatUSD(pool.totalValueLockedUSD)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatUSD(pool.volumeUSD)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {parseInt(pool.txCount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSwapsModal({
                                poolId: pool.id,
                                poolName: pool.name,
                                token0: pool.token0,
                                token1: pool.token1,
                              });
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                            disabled={loading}
                          >
                            {loading ? "Loading..." : "View Swaps"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredPools.length > 10 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAllPools(!showAllPools)}
              className="px-4 py-2 text-sm rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              {showAllPools ? "Show Less" : `Show All ${filteredPools.length} Pools`}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPool && (
        <HookPoolsModal
          pool={selectedPool}
          onClose={() => setSelectedPool(null)}
        />
      )}

      {showSwapsModal && (
        <PoolSwapsModal
          poolId={showSwapsModal.poolId}
          poolName={showSwapsModal.poolName}
          token0={showSwapsModal.token0}
          token1={showSwapsModal.token1}
          onClose={() => setShowSwapsModal(null)}
        />
      )}
        </>
      )}
    </div>
  );
}