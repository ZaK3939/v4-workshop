import { useEffect, useRef, useState, useCallback } from "react";
import { X, ExternalLink, Code, DollarSign, Activity, TrendingUp, ArrowDownUp, Droplet } from "lucide-react";
import { motion } from "framer-motion";
import { gql } from "graphql-request";
import { graphqlClient } from "@/lib/graphql";

// Helper functions
const formatUSD = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
};

const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const extractPoolAddress = (id: string): string => {
  if (!id) return "";
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

const formatFee = (feeTier: string): string => {
  const feeNum = parseInt(feeTier);
  const DYNAMIC_FEE_FLAG = 0x800000;
  if ((feeNum & DYNAMIC_FEE_FLAG) !== 0) {
    return "Dynamic";
  }
  return `${(feeNum / 10000).toFixed(2)}%`;
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
};

const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(parseInt(timestamp) * 1000);
  const diffMs = now.getTime() - time.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
};

// Queries
const HOOK_SWAPS_QUERY = gql`
  query HookSwaps($poolIds: [String!], $limit: Int!) {
    Swap(
      where: { pool: { _in: $poolIds } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      amount0
      amount1
      amountUSD
      timestamp
      transaction
      sender
      origin
      pool
    }
  }
`;

const HOOK_LIQUIDITY_QUERY = gql`
  query HookLiquidity($poolIds: [String!], $limit: Int!) {
    ModifyLiquidity(
      where: { pool: { id: { _in: $poolIds } } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      amount
      amountUSD
      timestamp
      transaction
      sender
      pool {
        id
      }
    }
  }
`;

interface HooksModalProps {
  hook: any;
  onClose: () => void;
}

type TabType = 'pools' | 'swaps' | 'liquidity';

export function HooksModal({ hook, onClose }: HooksModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pools');
  const [swaps, setSwaps] = useState<any[]>([]);
  const [liquidityEvents, setLiquidityEvents] = useState<any[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const [loadingLiquidity, setLoadingLiquidity] = useState(false);

  const fetchSwaps = useCallback(async () => {
    setLoadingSwaps(true);
    try {
      const poolIds = hook.pools.map((p: any) => p.id);
      const response = await graphqlClient.request<{ Swap: any[] }>(
        HOOK_SWAPS_QUERY,
        { poolIds, limit: 20 }
      );
      setSwaps(response.Swap || []);
    } catch (error) {
      console.error("Error fetching swaps:", error);
    } finally {
      setLoadingSwaps(false);
    }
  }, [hook.pools]);

  const fetchLiquidity = useCallback(async () => {
    setLoadingLiquidity(true);
    try {
      const poolIds = hook.pools.map((p: any) => p.id);
      const response = await graphqlClient.request<{ ModifyLiquidity: any[] }>(
        HOOK_LIQUIDITY_QUERY,
        { poolIds, limit: 20 }
      );
      setLiquidityEvents(response.ModifyLiquidity || []);
    } catch (error) {
      console.error("Error fetching liquidity:", error);
    } finally {
      setLoadingLiquidity(false);
    }
  }, [hook.pools]);

  // Fetch swaps when tab is selected
  useEffect(() => {
    if (activeTab === 'swaps' && swaps.length === 0) {
      fetchSwaps();
    }
  }, [activeTab, swaps.length, fetchSwaps]);

  // Fetch liquidity events when tab is selected
  useEffect(() => {
    if (activeTab === 'liquidity' && liquidityEvents.length === 0) {
      fetchLiquidity();
    }
  }, [activeTab, liquidityEvents.length, fetchLiquidity]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const hookUrl = `https://hookrank.io/130/${hook.address.toLowerCase()}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        ref={modalRef}
        className="bg-background rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div>
            <h2 className="text-lg font-semibold">Hook Details</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-muted-foreground">{shortenAddress(hook.address)}</span>
              <a
                href={hookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-4 gap-4 border-b border-border/50">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Pools</div>
            <div className="text-lg font-semibold">{hook.poolCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Total TVL</div>
            <div className="text-lg font-semibold">{formatUSD(hook.totalValueLockedUSD)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
            <div className="text-lg font-semibold">{formatUSD(hook.totalVolumeUSD)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Total Fees</div>
            <div className="text-lg font-semibold">{formatUSD(hook.totalFeesUSD)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'pools'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('pools')}
          >
            Pools ({hook.poolCount})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'swaps'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('swaps')}
          >
            Swaps
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'liquidity'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('liquidity')}
          >
            Liquidity
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'pools' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pools using this hook</h3>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pool</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Fee</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">TVL</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Volume</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Swaps</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {hook.pools.map((pool: any) => {
                        const poolAddress = extractPoolAddress(pool.id);
                        const poolUrl = `https://app.uniswap.org/explore/pools/unichain/${poolAddress}`;
                        return (
                          <tr key={pool.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{pool.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {shortenAddress(poolAddress)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm">{formatFee(pool.feeTier)}</td>
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
                              <div className="flex items-center justify-center">
                                <a
                                  href={poolUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'swaps' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Recent Swaps</h3>
              {loadingSwaps ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : swaps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No swaps found</div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="border-b border-border/50 bg-secondary/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pool</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Trader</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {swaps.map((swap) => {
                          const pool = hook.pools.find((p: any) => p.id === swap.pool);
                          return (
                            <tr key={swap.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3 text-sm">{formatRelativeTime(swap.timestamp)}</td>
                              <td className="px-4 py-3 text-sm">{pool?.name || 'Unknown'}</td>
                              <td className="px-4 py-3 text-right font-mono text-sm">
                                {formatUSD(swap.amountUSD)}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono">
                                {shortenAddress(swap.sender)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <a
                                  href={`https://uniscan.xyz/tx/${swap.transaction}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'liquidity' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Recent Liquidity Actions</h3>
              {loadingLiquidity ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : liquidityEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No liquidity events found</div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="border-b border-border/50 bg-secondary/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pool</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Provider</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {liquidityEvents.map((event) => {
                          const pool = hook.pools.find((p: any) => p.id === event.pool?.id);
                          const isAdd = parseFloat(event.amount) > 0;
                          return (
                            <tr key={event.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3 text-sm">{formatRelativeTime(event.timestamp)}</td>
                              <td className="px-4 py-3 text-sm">{pool?.name || 'Unknown'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 text-sm ${
                                  isAdd ? 'text-green-500' : 'text-red-500'
                                }`}>
                                  {isAdd ? <ArrowDownUp className="w-3 h-3" /> : <Droplet className="w-3 h-3" />}
                                  {isAdd ? 'Add' : 'Remove'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm">
                                {formatUSD(event.amountUSD || '0')}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono">
                                {shortenAddress(event.sender)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <a
                                  href={`https://uniscan.xyz/tx/${event.transaction}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}