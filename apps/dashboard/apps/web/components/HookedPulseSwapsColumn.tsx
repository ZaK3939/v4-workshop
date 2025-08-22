import { useEffect, useState, useRef, useCallback } from "react";
import { ExternalLink, ArrowDownUp, Code } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { graphqlClient } from "@/lib/graphql";
import { gql } from "graphql-request";

// Queries
const HOOKED_POOLS_QUERY = gql`
  query HookedPools {
    Pool(
      where: { 
        hooks: { _neq: "0x0000000000000000000000000000000000000000" }
        chainId: { _eq: "130" }
      }
    ) {
      id
      name
      hooks
      feeTier
      totalValueLockedUSD
      token0
      token1
    }
  }
`;

const RECENT_SWAPS_QUERY = gql`
  query RecentSwaps($poolIds: [String!], $limit: Int!) {
    Swap(
      where: { pool: { _in: $poolIds } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      amount0
      amount1
      amountUSD
      origin
      sender
      timestamp
      transaction
      pool
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
    }
  }
`;

// Interfaces
interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

interface PoolInfo {
  id: string;
  name: string;
  hooks: string;
  feeTier: string;
  totalValueLockedUSD: string;
  token0?: string;
  token1?: string;
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
  pool: string;
  token0: Token;
  token1: Token;
  poolInfo?: PoolInfo;
  uniqueId?: string;
  animationId?: number;
}

// Helper function to format USD values
const formatUSD = (value: string): string => {
  const num = parseFloat(value);
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  } else if (num >= 1) {
    return `$${num.toFixed(2)}`;
  } else {
    return `$${num.toFixed(4)}`;
  }
};

// Helper function to shorten address
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get timestamp display
const getSwapTimestamp = (timestamp: string) => {
  const swapTime = new Date(parseInt(timestamp) * 1000);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - swapTime.getTime()) / 1000);

  if (diffSeconds < 5) {
    return "now";
  } else if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else {
    return swapTime.toLocaleTimeString();
  }
};

// Generate unique ID
const generateUniqueId = (swapId: string): string => {
  const timestamp = Date.now();
  const nanoTime = typeof performance !== "undefined"
    ? performance.now().toString().replace(".", "")
    : "0";
  const random = Math.random().toString(36).substring(2, 10);
  return `${swapId}_${timestamp}_${nanoTime}_${random}`;
};

export function HookedPulseSwapsColumn() {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [poolInfoMap, setPoolInfoMap] = useState<Map<string, PoolInfo>>(new Map());
  const prevSwapsRef = useRef<Swap[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const animationCounterRef = useRef<number>(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process pending swaps one by one
  const processNextPendingSwap = useCallback(() => {
    if (isPaused) return;

    setPendingSwaps((current) => {
      if (current.length === 0) return current;

      const nextSwap = current[0];
      if (!nextSwap) return current;

      const remainingSwaps = current.slice(1);

      // Add the next swap to the main list
      setSwaps((prevSwaps) => {
        if (prevSwaps.some((existing) => existing.id === nextSwap.id)) {
          return prevSwaps;
        }
        const newSwaps = [nextSwap, ...prevSwaps.slice(0, 24)] as Swap[];
        return newSwaps;
      });

      // Schedule next animation
      if (remainingSwaps.length > 0) {
        const timeout = Math.max(50, 250 - remainingSwaps.length * 10);
        animationTimeoutRef.current = setTimeout(processNextPendingSwap, timeout);
      }

      return remainingSwaps;
    });
  }, [isPaused]);

  // Handle new swaps
  useEffect(() => {
    if (pendingSwaps.length > 0 && !isPaused && !animationTimeoutRef.current) {
      animationTimeoutRef.current = setTimeout(() => {
        processNextPendingSwap();
        animationTimeoutRef.current = null;
      }, 100);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [pendingSwaps, isPaused, processNextPendingSwap]);

  // Fetch data
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isPaused) return;

      try {
        // First get hooked pools
        const poolsResult = await graphqlClient.request<{ Pool: PoolInfo[] }>(HOOKED_POOLS_QUERY);
        const hookedPools = poolsResult.Pool || [];
        const poolIds = hookedPools.map(p => p.id);
        
        if (poolIds.length === 0) {
          setSwaps([]);
          setError(null);
          return;
        }

        // Update pool info map
        const newPoolInfoMap = new Map<string, PoolInfo>();
        hookedPools.forEach(pool => {
          newPoolInfoMap.set(pool.id, pool);
        });
        setPoolInfoMap(newPoolInfoMap);

        // Fetch recent swaps
        const swapsResult = await graphqlClient.request<{ Swap: Swap[] }>(
          RECENT_SWAPS_QUERY,
          { poolIds, limit: 30 }
        );

        if (!isMounted) return;

        // Add unique IDs and pool info
        const swapsWithIds = swapsResult.Swap.map((swap) => ({
          ...swap,
          uniqueId: generateUniqueId(swap.id),
          poolInfo: newPoolInfoMap.get(swap.pool)
        }));

        // Find new swaps
        const newSwaps = swapsWithIds.filter(
          (swap) => !prevSwapsRef.current.some((prevSwap) => prevSwap.id === swap.id)
        );

        // Add animation IDs
        const newSwapsWithAnimationIds = newSwaps.map((swap, index) => ({
          ...swap,
          animationId: animationCounterRef.current + index,
        }));

        animationCounterRef.current += newSwaps.length;

        // Add to pending queue
        if (newSwapsWithAnimationIds.length > 0) {
          setPendingSwaps((current) => {
            const existingIds = new Set(current.map((swap) => swap.id));
            const filteredNewSwaps = newSwapsWithAnimationIds.filter(
              (swap) => !existingIds.has(swap.id)
            );
            return [...current, ...filteredNewSwaps];
          });
        }

        prevSwapsRef.current = swapsWithIds;
        setError(null);
      } catch (err) {
        console.error("Error fetching hooked swaps:", err);
        if (isMounted) {
          setError("Failed to fetch hook swaps");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 2000); // Update every 2 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isPaused]);

  return (
    <div className="h-full">
      <div className="p-3 border-b border-border/50 flex justify-between items-center">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ArrowDownUp className="w-4 h-4" />
          Hook Swaps
        </h3>
        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="bg-pink-500/10 text-pink-500 text-xs px-2 py-0.5 rounded-full">
              Paused
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {pendingSwaps.length > 0 ? (
              <span className="text-pink-500/80">
                {pendingSwaps.length} swaps incoming
              </span>
            ) : (
              `${swaps.length} recent swaps`
            )}
          </div>
        </div>
      </div>

      <div
        className="max-h-[600px] overflow-y-auto p-2 relative"
        style={{ scrollBehavior: "smooth" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading && swaps.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center text-sm">{error}</div>
        ) : swaps.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No recent hook swaps
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {swaps.map((swap) => {
                if (!swap || !swap.uniqueId) return null;

                const token0Name = swap.token0?.symbol || swap.token0?.name || "Unknown";
                const token1Name = swap.token1?.symbol || swap.token1?.name || "Unknown";
                const poolName = swap.poolInfo?.name || `${token0Name}/${token1Name}`;
                const hookAddress = swap.poolInfo?.hooks || "";
                const formattedAmount = formatUSD(swap.amountUSD);
                const timestamp = getSwapTimestamp(swap.timestamp);

                return (
                  <motion.div
                    key={`swap_${swap.uniqueId}`}
                    className="bg-secondary/30 rounded-lg p-2 overflow-hidden hover:bg-secondary/50 transition-colors group"
                    initial={{
                      opacity: 0,
                      y: -20,
                      backgroundColor: "rgba(236, 72, 153, 0.2)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.1)",
                      transition: {
                        backgroundColor: { delay: 0.3, duration: 0.5 },
                      },
                    }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{
                      duration: 0.3,
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                    layout="position"
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="text-xs font-medium text-muted-foreground">
                        {timestamp}
                      </div>
                      <a
                        href={`https://hookrank.io/130/${hookAddress.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors"
                        title="View Hook"
                      >
                        <Code className="w-3 h-3" />
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{poolName}</div>
                        {hookAddress && (
                          <div className="text-xs text-muted-foreground">
                            Hook: {shortenAddress(hookAddress)}
                          </div>
                        )}
                      </div>
                      <motion.div
                        className="text-sm font-mono text-pink-500"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: 1,
                          scale: [0.8, 1.1, 1],
                        }}
                        transition={{
                          duration: 0.3,
                        }}
                      >
                        {formattedAmount}
                      </motion.div>
                    </div>

                    {/* Transaction details on hover */}
                    <motion.div
                      className="text-xs mt-1 pt-1 border-t border-border/20 text-muted-foreground group-hover:!block"
                      initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        transition: { duration: 0.2 },
                      }}
                      style={{
                        display: "none",
                        transition: "all 0.2s",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className={parseFloat(swap.amount0) > 0 ? "text-green-500" : "text-red-500"}>
                            {Math.abs(parseFloat(swap.amount0)).toFixed(4)} {token0Name}
                          </span>
                          <ArrowDownUp className="w-3 h-3 opacity-50" />
                          <span className={parseFloat(swap.amount1) > 0 ? "text-green-500" : "text-red-500"}>
                            {Math.abs(parseFloat(swap.amount1)).toFixed(4)} {token1Name}
                          </span>
                        </div>
                        <a
                          href={`https://uniscan.xyz/tx/${swap.transaction}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Incoming swaps indicator */}
            {isPaused && pendingSwaps.length > 0 && (
              <motion.div
                className="bg-pink-500/10 text-center py-2 px-4 rounded-md text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-pulse h-2 w-2 rounded-full bg-pink-500"></div>
                  <span>{pendingSwaps.length} new swaps waiting</span>
                </div>
                <button
                  className="text-xs text-pink-500 mt-1 hover:underline"
                  onClick={() => {
                    setIsPaused(false);
                    setTimeout(() => setIsPaused(true), 100);
                  }}
                >
                  Click to process
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}