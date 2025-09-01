import { useEffect, useState, useRef, useCallback } from "react";
import { ExternalLink, Droplet, Code, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { graphqlClient } from "@/lib/graphql";
import { gql } from "graphql-request";

// Query
const RECENT_LIQUIDITY_QUERY = gql`
  query RecentLiquidity($limit: Int!) {
    ModifyLiquidity(
      where: {
        pool: {
          hooks: { _neq: "0x0000000000000000000000000000000000000000" }
          chainId: { _eq: "130" }
        }
      }
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
        name
        hooks
        feeTier
        token0
        token1
        totalValueLockedUSD
      }
    }
  }
`;

// Interfaces
interface PoolInfo {
  id: string;
  name: string;
  hooks: string;
  feeTier: string;
  totalValueLockedUSD: string;
  token0?: string;
  token1?: string;
}

interface ModifyLiquidity {
  id: string;
  amount: string;
  amountUSD?: string;
  timestamp: string;
  transaction: string;
  sender: string;
  pool: PoolInfo;
  uniqueId?: string;
  animationId?: number;
}

// Helper function to shorten address
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get timestamp display
const getActivityTimestamp = (timestamp: string) => {
  const activityTime = new Date(parseInt(timestamp) * 1000);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000);

  if (diffSeconds < 5) {
    return "now";
  } else if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else {
    return activityTime.toLocaleTimeString();
  }
};

// Format liquidity amount (raw liquidity units - just show as Add/Remove)
const formatLiquidityAmount = (amount: string): { isAdd: boolean } => {
  const num = parseFloat(amount);
  const isAdd = num > 0;
  return { isAdd };
};

// Format USD values
const formatUSD = (value: string | undefined): string => {
  if (!value) return "Liquidity";
  
  const num = parseFloat(value);
  if (isNaN(num)) return "Liquidity";
  
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

// Format fee tier
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

// Generate unique ID
const generateUniqueId = (liquidityId: string): string => {
  const timestamp = Date.now();
  const nanoTime = typeof performance !== "undefined"
    ? performance.now().toString().replace(".", "")
    : "0";
  const random = Math.random().toString(36).substring(2, 10);
  return `${liquidityId}_${timestamp}_${nanoTime}_${random}`;
};

export function HookedPulseLiquidityColumn() {
  const [liquidity, setLiquidity] = useState<ModifyLiquidity[]>([]);
  const [pendingLiquidity, setPendingLiquidity] = useState<ModifyLiquidity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const prevLiquidityRef = useRef<ModifyLiquidity[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const animationCounterRef = useRef<number>(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process pending liquidity one by one
  const processNextPendingLiquidity = useCallback(() => {
    if (isPaused) return;

    setPendingLiquidity((current) => {
      if (current.length === 0) return current;

      const nextLiquidity = current[0];
      if (!nextLiquidity) return current;

      const remainingLiquidity = current.slice(1);

      // Add the next liquidity event to the main list
      setLiquidity((prevLiquidity) => {
        if (prevLiquidity.some((existing) => existing.id === nextLiquidity.id)) {
          return prevLiquidity;
        }
        const newLiquidity = [nextLiquidity, ...prevLiquidity.slice(0, 24)] as ModifyLiquidity[];
        return newLiquidity;
      });

      // Schedule next animation
      if (remainingLiquidity.length > 0) {
        const timeout = Math.max(50, 250 - remainingLiquidity.length * 10);
        animationTimeoutRef.current = setTimeout(processNextPendingLiquidity, timeout);
      }

      return remainingLiquidity;
    });
  }, [isPaused]);

  // Handle new liquidity events
  useEffect(() => {
    if (pendingLiquidity.length > 0 && !isPaused && !animationTimeoutRef.current) {
      animationTimeoutRef.current = setTimeout(() => {
        processNextPendingLiquidity();
        animationTimeoutRef.current = null;
      }, 100);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [pendingLiquidity, isPaused, processNextPendingLiquidity]);

  // Fetch data
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isPaused) return;

      try {
        // Fetch recent liquidity modifications
        const liquidityResult = await graphqlClient.request<{ ModifyLiquidity: ModifyLiquidity[] }>(
          RECENT_LIQUIDITY_QUERY,
          { limit: 50 }
        );

        if (!isMounted) return;

        // Add unique IDs
        const hookedLiquidity = (liquidityResult.ModifyLiquidity || [])
          .map((liq) => ({
            ...liq,
            uniqueId: generateUniqueId(liq.id)
          }));

        // Find new liquidity events
        const newLiquidity = hookedLiquidity.filter(
          (liq) => !prevLiquidityRef.current.some((prevLiq) => prevLiq.id === liq.id)
        );

        // Add animation IDs
        const newLiquidityWithAnimationIds = newLiquidity.map((liq, index) => ({
          ...liq,
          animationId: animationCounterRef.current + index,
        }));

        animationCounterRef.current += newLiquidity.length;

        // Add to pending queue
        if (newLiquidityWithAnimationIds.length > 0) {
          setPendingLiquidity((current) => {
            const existingIds = new Set(current.map((liq) => liq.id));
            const filteredNewLiquidity = newLiquidityWithAnimationIds.filter(
              (liq) => !existingIds.has(liq.id)
            );
            return [...current, ...filteredNewLiquidity];
          });
        }

        prevLiquidityRef.current = hookedLiquidity;
        setError(null);
      } catch (err) {
        console.error("Error fetching hooked liquidity:", err);
        if (isMounted) {
          setError("Failed to fetch liquidity data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 3000); // Update every 3 seconds

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
          <Droplet className="w-4 h-4" />
          Hook Liquidity
        </h3>
        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="bg-blue-500/10 text-blue-500 text-xs px-2 py-0.5 rounded-full">
              Paused
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {pendingLiquidity.length > 0 ? (
              <span className="text-blue-500/80">
                {pendingLiquidity.length} events incoming
              </span>
            ) : (
              `${liquidity.length} recent events`
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
        {loading && liquidity.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center text-sm">{error}</div>
        ) : liquidity.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No recent liquidity activity
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {liquidity.map((activity) => {
                if (!activity || !activity.uniqueId) return null;

                const { isAdd } = formatLiquidityAmount(activity.amount);
                const value = formatUSD(activity.amountUSD);
                const poolName = activity.pool?.name || `Pool ${shortenAddress(activity.pool?.id || "")}`;
                const hookAddress = activity.pool?.hooks || "";
                const feeTier = activity.pool?.feeTier || "0";
                const timestamp = getActivityTimestamp(activity.timestamp);

                return (
                  <motion.div
                    key={`liq_${activity.uniqueId}`}
                    className="bg-secondary/30 rounded-lg p-2 overflow-hidden hover:bg-secondary/50 transition-colors group"
                    initial={{
                      opacity: 0,
                      y: -20,
                      backgroundColor: isAdd ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{poolName}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFee(feeTier)})
                          </span>
                        </div>
                        {hookAddress && (
                          <div className="text-xs text-muted-foreground">
                            Hook: {shortenAddress(hookAddress)}
                          </div>
                        )}
                      </div>
                      <motion.div
                        className={`flex items-center gap-1 text-sm font-medium ${isAdd ? 'text-green-500' : 'text-red-500'}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: 1,
                          scale: [0.8, 1.1, 1],
                        }}
                        transition={{
                          duration: 0.3,
                        }}
                      >
                        {isAdd ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        <span>{value}</span>
                      </motion.div>
                    </div>

                    {/* Provider details on hover */}
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
                          <span>Provider: {shortenAddress(activity.sender)}</span>
                        </div>
                        <a
                          href={`https://uniscan.xyz/tx/${activity.transaction}`}
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

            {/* Incoming events indicator */}
            {isPaused && pendingLiquidity.length > 0 && (
              <motion.div
                className="bg-blue-500/10 text-center py-2 px-4 rounded-md text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>{pendingLiquidity.length} new events waiting</span>
                </div>
                <button
                  className="text-xs text-blue-500 mt-1 hover:underline"
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