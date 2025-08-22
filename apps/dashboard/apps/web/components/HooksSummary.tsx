import { useState } from "react";
import { useHooks } from "@/hooks/useHooks";
import { ExternalLink, Info, TrendingUp, DollarSign, Activity, Code } from "lucide-react";
import { HooksModal } from "./HooksModal";

// Helper function to format USD values
const formatUSD = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
};

// Helper function to shorten address
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

interface HooksSummaryProps {
  hookFilter?: string;
}

export function HooksSummary({ hookFilter }: HooksSummaryProps) {
  const { hooks, loading, error } = useHooks();
  const [selectedHook, setSelectedHook] = useState<any | null>(null);
  const [showAllHooks, setShowAllHooks] = useState(false);

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load hooks. Please try again later.
      </div>
    );
  }

  // Filter hooks by address if filter is provided
  const filteredHooks = hookFilter
    ? hooks.filter(hook => 
        hook.address.toLowerCase().includes(hookFilter.toLowerCase())
      )
    : hooks;

  const displayedHooks = showAllHooks ? filteredHooks : filteredHooks.slice(0, 10);

  // Calculate totals from filtered hooks
  const totalHooks = filteredHooks.length;
  const totalPools = filteredHooks.reduce((acc, hook) => acc + hook.poolCount, 0);
  const totalTVL = filteredHooks.reduce((acc, hook) => acc + hook.totalValueLockedUSD, 0);
  const totalVolume = filteredHooks.reduce((acc, hook) => acc + hook.totalVolumeUSD, 0);
  const totalFees = filteredHooks.reduce((acc, hook) => acc + hook.totalFeesUSD, 0);

  return (
    <div className="space-y-6">
      {filteredHooks.length === 0 && hookFilter ? (
        <div className="py-10 text-center text-muted-foreground">
          No hooks found with address containing &quot;{hookFilter}&quot;
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Code className="w-4 h-4" />
            <span>Total Hooks</span>
          </div>
          <div className="text-2xl font-semibold">{totalHooks}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {totalPools} pools total
          </div>
        </div>
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Total TVL</span>
          </div>
          <div className="text-2xl font-semibold">{formatUSD(totalTVL)}</div>
        </div>
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Total Volume</span>
          </div>
          <div className="text-2xl font-semibold">{formatUSD(totalVolume)}</div>
        </div>
        <div className="bg-secondary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Activity className="w-4 h-4" />
            <span>Total Fees</span>
          </div>
          <div className="text-2xl font-semibold">{formatUSD(totalFees)}</div>
        </div>
      </div>

      {/* Hooks Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Hooks Overview</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hookFilter 
                ? `Showing ${filteredHooks.length} hooks with address containing "${hookFilter}"`
                : `Aggregated metrics for each hook address`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Click hook for pool details</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hook Address</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Pools</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">TVL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Volume</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Fees</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayedHooks.map((hook) => (
                  <tr
                    key={hook.address}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedHook(hook)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{shortenAddress(hook.address)}</span>
                        <a
                          href={`https://hookrank.io/130/${hook.address.toLowerCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        {hook.poolCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(hook.totalValueLockedUSD)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(hook.totalVolumeUSD)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(hook.totalFeesUSD)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHook(hook);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        >
                          View Pools
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredHooks.length > 10 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAllHooks(!showAllHooks)}
              className="px-4 py-2 text-sm rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              {showAllHooks ? "Show Less" : `Show All ${filteredHooks.length} Hooks`}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedHook && (
        <HooksModal
          hook={selectedHook}
          onClose={() => setSelectedHook(null)}
        />
      )}
        </>
      )}
    </div>
  );
}