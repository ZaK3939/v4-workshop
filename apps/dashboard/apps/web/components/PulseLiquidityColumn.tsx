import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { graphqlClient } from "@/lib/graphql";
import { Copy, ExternalLink, Plus, Minus } from "lucide-react";

interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: string;
}

interface ModifyLiquidity {
  id: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  tickLower: string;
  tickUpper: string;
  sender: string;
  timestamp: string;
  transaction: string;
  pool: {
    id: string;
  };
  token0: Token;
  token1: Token;
  uniqueId?: string;
  animationId?: number;
}

interface RecentLiquidityResponse {
  ModifyLiquidity: ModifyLiquidity[];
}

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

// Network names mapping
const NETWORK_NAMES: Record<string, string> = {
  "130": "Unichain",
};

// Helper function to extract chain ID from the new format
const extractChainId = (id: string): string => {
  if (!id) return "";
  if (id.includes("_")) {
    const chainId = id.split("_")[0];
    return chainId || id;
  }
  return id;
};

// Generate a guaranteed unique ID for each liquidity event
const generateUniqueId = (liquidityId: string): string => {
  const timestamp = Date.now();
  const nanoTime =
    typeof performance !== "undefined"
      ? performance.now().toString().replace(".", "")
      : "0";
  const random = Math.random().toString(36).substring(2, 10);
  return `${liquidityId}_${timestamp}_${nanoTime}_${random}`;
};

// Recent liquidity modifications query
const RECENT_LIQUIDITY_QUERY = `
  query recentLiquidity($limit: Int!) {
    ModifyLiquidity(
      order_by: {timestamp: desc}, 
      limit: $limit
    ) {
      id
      amount
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      sender
      timestamp
      transaction
      pool {
        id
      }
      token0 {
        id
        name
        symbol
        decimals
      }
      token1 {
        id
        name
        symbol
        decimals
      }
    }
  }
`;

export function PulseLiquidityColumn() {
  const [liquidityEvents, setLiquidityEvents] = useState<ModifyLiquidity[]>([]);
  const [pendingEvents, setPendingEvents] = useState<ModifyLiquidity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const prevEventsRef = useRef<ModifyLiquidity[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const animationCounterRef = useRef<number>(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add liquidity event animation one by one
  const processNextPendingEvent = useCallback(() => {
    if (isPaused) return;

    setPendingEvents((current) => {
      if (current.length === 0) return current;

      const nextEvent = current[0];
      if (!nextEvent) return current;

      const remainingEvents = current.slice(1);

      // Add the next event to the main list
      setLiquidityEvents((prevEvents) => {
        // Skip if we already have this event (by ID)
        if (prevEvents.some((existing) => existing.id === nextEvent.id)) {
          return prevEvents;
        }

        // Keep only the latest events (max 25)
        const newEvents = [nextEvent, ...prevEvents.slice(0, 24)] as ModifyLiquidity[];
        return newEvents;
      });

      // If there are more pending events, schedule the next one
      if (remainingEvents.length > 0) {
        const timeout = Math.max(50, 250 - remainingEvents.length * 10);
        animationTimeoutRef.current = setTimeout(
          processNextPendingEvent,
          timeout
        );
      }

      return remainingEvents;
    });
  }, [isPaused]);

  // Handle new events coming in
  useEffect(() => {
    if (pendingEvents.length > 0 && !isPaused && !animationTimeoutRef.current) {
      animationTimeoutRef.current = setTimeout(() => {
        processNextPendingEvent();
        animationTimeoutRef.current = null;
      }, 100);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [pendingEvents, isPaused, processNextPendingEvent]);

  // Fetch recent liquidity modifications
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (isPaused) return;

      try {
        const data = await graphqlClient.request<RecentLiquidityResponse>(
          RECENT_LIQUIDITY_QUERY,
          {
            limit: 30,
          }
        );

        // Add a unique identifier to each event
        const eventsWithIds = data.ModifyLiquidity.map((event) => ({
          ...event,
          uniqueId: generateUniqueId(event.id),
        }));

        // Find truly new events (not in previous batch)
        const newEvents = eventsWithIds.filter(
          (event) =>
            !prevEventsRef.current.some((prevEvent) => prevEvent.id === event.id)
        );

        // Add animation sequence IDs to new events
        const newEventsWithAnimationIds = newEvents.map((event, index) => ({
          ...event,
          animationId: animationCounterRef.current + index,
        }));

        // Update counter for next batch
        animationCounterRef.current += newEvents.length;

        // If we have new events, add them to pending queue
        if (newEventsWithAnimationIds.length > 0) {
          setPendingEvents((current) => {
            const existingIds = new Set(current.map((event) => event.id));
            const filteredNewEvents = newEventsWithAnimationIds.filter(
              (event) => !existingIds.has(event.id)
            );
            return [...current, ...filteredNewEvents];
          });
        }

        // Update reference of previous events for next comparison
        prevEventsRef.current = eventsWithIds;

        setError(null);
      } catch (err) {
        console.error("Error fetching recent liquidity events:", err);
        if (isMounted) {
          setError("Failed to fetch liquidity events");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Fetch more frequently (1 second) for more continuous updates
    const intervalId = setInterval(fetchData, 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isPaused]);

  // Get event timestamp
  const getEventTimestamp = (timestamp: string) => {
    const eventTime = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - eventTime.getTime()) / 1000);

    if (diffSeconds < 5) {
      return "now";
    } else if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else {
      return eventTime.toLocaleTimeString();
    }
  };

  // Get block explorer URL based on chain ID
  const getBlockExplorerUrl = (chainId: string, txHash: string): string => {
    const explorers: Record<string, string> = {
      "1": "https://etherscan.io/tx/",
      "10": "https://optimistic.etherscan.io/tx/",
      "137": "https://polygonscan.com/tx/",
      "42161": "https://arbiscan.io/tx/",
      "8453": "https://basescan.org/tx/",
      "81457": "https://blastscan.io/tx/",
      "7777777": "https://explorer.zora.energy/tx/",
      "56": "https://bscscan.com/tx/",
      "43114": "https://snowtrace.io/tx/",
      "57073": "https://inkscan.io/tx/",
      "1868": "https://sonscan.io/tx/",
      "130": "https://uniscan.xyz/tx/",
    };

    const baseUrl = explorers[chainId] || "https://etherscan.io/tx/";
    return `${baseUrl}${txHash}`;
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Copied to clipboard:", text);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  };

  // Check if liquidity is being added or removed
  const isAddingLiquidity = (amount: string): boolean => {
    return !amount.startsWith("-");
  };

  return (
    <div className="h-full">
      <div className="p-3 border-b border-border/50 flex justify-between items-center">
        <h3 className="text-sm font-medium">Liquidity Activity</h3>
        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="bg-blue-500/10 text-blue-500 text-xs px-2 py-0.5 rounded-full">
              Paused
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {pendingEvents.length > 0 ? (
              <span className="text-blue-500/80">
                {pendingEvents.length} events incoming
              </span>
            ) : (
              `${liquidityEvents.length} recent events`
            )}
          </div>
        </div>
      </div>

      <div
        className="md:max-h-[400px] max-h-[350px] overflow-y-auto p-2 relative"
        style={{ scrollBehavior: "smooth" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading && liquidityEvents.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center text-sm">{error}</div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {liquidityEvents.map((event) => {
                if (!event || !event.uniqueId) return null;

                const chainId = extractChainId(event.pool.id);
                const networkName =
                  NETWORK_NAMES[chainId] || `Chain ${chainId}`;
                const token0Symbol = event.token0.symbol || "Token0";
                const token1Symbol = event.token1.symbol || "Token1";
                const formattedAmount = formatUSD(event.amountUSD);
                const timestamp = getEventTimestamp(event.timestamp);
                const isAdding = isAddingLiquidity(event.amount);

                return (
                  <motion.div
                    key={`liquidity_${event.uniqueId}`}
                    className="bg-secondary/30 rounded-lg p-2 overflow-hidden hover:bg-secondary/50 transition-colors group"
                    initial={{
                      opacity: 0,
                      y: -20,
                      backgroundColor: isAdding
                        ? "rgba(34, 197, 94, 0.2)" // Green for adding
                        : "rgba(239, 68, 68, 0.2)", // Red for removing
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
                      <div className="text-xs bg-secondary/50 px-2 py-0.5 rounded-full">
                        {networkName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {isAdding ? (
                          <Plus className="w-3 h-3 text-green-500" />
                        ) : (
                          <Minus className="w-3 h-3 text-red-500" />
                        )}
                        <span className="font-medium text-sm">
                          {isAdding ? "Add" : "Remove"} Liquidity
                        </span>
                      </div>
                      <div className="flex-1 text-sm text-muted-foreground">
                        {token0Symbol} / {token1Symbol}
                      </div>
                      <motion.div
                        className={`text-sm font-mono ${
                          isAdding ? "text-green-500" : "text-red-500"
                        }`}
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

                    {/* Transaction details - shows on hover */}
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
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap font-medium">
                          Tx:
                        </span>
                        <span className="text-xs font-mono">
                          {event.transaction.substring(0, 6)}...
                          {event.transaction.substring(
                            event.transaction.length - 4
                          )}
                        </span>
                        <div className="flex">
                          <button
                            className="p-1 hover:bg-blue-500/10 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(event.transaction);
                            }}
                            title="Copy transaction hash"
                          >
                            <Copy size={11} className="text-blue-500" />
                          </button>
                          <a
                            href={getBlockExplorerUrl(
                              chainId,
                              event.transaction
                            )}
                            target="__blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-blue-500/10 rounded-full"
                            onClick={(e) => e.stopPropagation()}
                            title="View on block explorer"
                          >
                            <ExternalLink size={11} className="text-blue-500" />
                          </a>
                        </div>
                      </div>
                      <div className="text-xs mt-1">
                        Range: [{parseInt(event.tickLower).toLocaleString()}, {parseInt(event.tickUpper).toLocaleString()}]
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Incoming events indicator when paused */}
            {isPaused && pendingEvents.length > 0 && (
              <motion.div
                className="bg-blue-500/10 text-center py-2 px-4 rounded-md text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>{pendingEvents.length} new events waiting</span>
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