import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { graphqlClient } from "@/lib/graphql";
import { Copy, ExternalLink } from "lucide-react";

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
  uniqueId?: string; // Optional unique identifier to prevent key conflicts
  animationId?: number; // Added to control sequence animations
}

interface RecentSwapsResponse {
  Swap: Swap[];
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
  // If the ID contains an underscore, extract the part before it
  if (id.includes("_")) {
    const chainId = id.split("_")[0];
    return chainId || id; // Fallback to original id if split fails
  }
  return id;
};

// Generate a guaranteed unique ID for each swap
const generateUniqueId = (swapId: string): string => {
  // Combine swap ID with timestamp (ms) + performance.now() (sub-ms precision) and random string
  const timestamp = Date.now();
  const nanoTime =
    typeof performance !== "undefined"
      ? performance.now().toString().replace(".", "")
      : "0";
  const random = Math.random().toString(36).substring(2, 10);

  return `${swapId}_${timestamp}_${nanoTime}_${random}`;
};

// Global recent swaps query
const RECENT_SWAPS_QUERY = `
  query recentSwaps($limit: Int!) {
    Swap(
      order_by: {timestamp: desc}, 
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
      sqrtPriceX96
      tick
      chainId
    }
  }
`;

export function RecentSwapsPopup({ isVisible }: { isVisible: boolean }) {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const prevSwapsRef = useRef<Swap[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const animationCounterRef = useRef<number>(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add swap animation one by one
  const processNextPendingSwap = useCallback(() => {
    if (isPaused) return;

    setPendingSwaps((current) => {
      if (current.length === 0) return current;

      const nextSwap = current[0];
      if (!nextSwap) return current;

      const remainingSwaps = current.slice(1);

      // Add the next swap to the main list
      setSwaps((prevSwaps) => {
        // Skip if we already have this swap (by ID)
        if (prevSwaps.some((existing) => existing.id === nextSwap.id)) {
          return prevSwaps;
        }

        // Keep only the latest swaps (max 20)
        const newSwaps = [nextSwap, ...prevSwaps.slice(0, 19)] as Swap[];
        return newSwaps;
      });

      // If there are more pending swaps, schedule the next one
      if (remainingSwaps.length > 0) {
        // Adjust the timeouts based on number of remaining swaps
        // More swaps = faster animations to catch up
        const timeout = Math.max(50, 250 - remainingSwaps.length * 10);
        animationTimeoutRef.current = setTimeout(
          processNextPendingSwap,
          timeout
        );
      }

      return remainingSwaps;
    });
  }, [isPaused]);

  // Handle new swaps coming in
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

  // Fetch recent swaps
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    const fetchData = async () => {
      if (isPaused) return; // Don't fetch if paused

      try {
        const data = await graphqlClient.request<RecentSwapsResponse>(
          RECENT_SWAPS_QUERY,
          {
            limit: 50, // Fetch more to have a good stream
          }
        );

        if (!isMounted) return;

        // Add a unique identifier to each swap
        const swapsWithIds = data.Swap.map((swap) => ({
          ...swap,
          uniqueId: generateUniqueId(swap.id),
        }));

        // Find truly new swaps (not in previous batch)
        const newSwaps = swapsWithIds.filter(
          (swap) =>
            !prevSwapsRef.current.some((prevSwap) => prevSwap.id === swap.id)
        );

        // Add animation sequence IDs to new swaps
        const newSwapsWithAnimationIds = newSwaps.map((swap, index) => ({
          ...swap,
          animationId: animationCounterRef.current + index,
        }));

        // Update counter for next batch
        animationCounterRef.current += newSwaps.length;

        // If we have new swaps, add them to pending queue
        if (newSwapsWithAnimationIds.length > 0) {
          setPendingSwaps((current) => {
            // Create a Set of existing IDs to avoid duplicates
            const existingIds = new Set(current.map((swap) => swap.id));

            // Only add swaps that aren't already in the pending queue
            const filteredNewSwaps = newSwapsWithAnimationIds.filter(
              (swap) => !existingIds.has(swap.id)
            );

            return [...current, ...filteredNewSwaps];
          });
        }

        // Update reference of previous swaps for next comparison
        prevSwapsRef.current = swapsWithIds;

        setError(null);
      } catch (err) {
        console.error("Error fetching recent swaps:", err);
        if (isMounted) {
          setError("Failed to fetch recent swaps");
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
  }, [isVisible, isPaused]);

  // Inspect with optional timestamp display for older swaps
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

    const baseUrl = explorers[chainId] || "https://etherscan.io/tx/"; // Default to Ethereum
    return `${baseUrl}${txHash}`;
  };

  // Copy text to clipboard with feedback
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Could add a toast notification here if desired
        console.log("Copied to clipboard:", text);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  };

  if (!isVisible) return null;

  return (
    <motion.div
      className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-background border border-border/50 rounded-lg shadow-xl z-[9999] overflow-hidden"
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      <div className="p-3 border-b border-border/50 flex justify-between items-center">
        <h3 className="text-sm font-medium">Real-time Swaps</h3>
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
        className="max-h-[400px] overflow-y-auto p-2 relative"
        style={{ scrollBehavior: "smooth" }}
      >
        {loading && swaps.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center text-sm">{error}</div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {swaps.map((swap) => {
                if (!swap || !swap.uniqueId) return null; // Skip invalid swaps

                const chainId = extractChainId(swap.chainId);
                const networkName =
                  NETWORK_NAMES[chainId] || `Chain ${chainId}`;
                const token0Symbol = swap.token0.symbol || "Token0";
                const token1Symbol = swap.token1.symbol || "Token1";
                const formattedAmount = formatUSD(swap.amountUSD);
                const timestamp = getSwapTimestamp(swap.timestamp);

                return (
                  <motion.div
                    key={`swap_${swap.uniqueId}`}
                    className="bg-secondary/30 rounded-lg p-3 overflow-hidden hover:bg-secondary/50 transition-colors group"
                    initial={{
                      opacity: 0,
                      y: -20,
                      backgroundColor: "rgba(236, 72, 153, 0.2)", // Light pink color (tailwind pink-500 with low opacity)
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
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        {timestamp}
                      </div>
                      <div className="text-xs bg-secondary/50 px-2 py-0.5 rounded-full">
                        {networkName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 font-medium text-sm">
                        {token0Symbol} → {token1Symbol}
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

                    {/* Transaction details - now shows on entire box hover */}
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
                          {swap.transaction.substring(0, 6)}...
                          {swap.transaction.substring(
                            swap.transaction.length - 4
                          )}
                        </span>
                        <div className="flex">
                          <button
                            className="p-1 hover:bg-pink-500/10 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(swap.transaction);
                            }}
                            title="Copy transaction hash"
                          >
                            <Copy size={11} className="text-pink-500" />
                          </button>
                          <a
                            href={getBlockExplorerUrl(
                              chainId,
                              swap.transaction
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-pink-500/10 rounded-full"
                            onClick={(e) => e.stopPropagation()}
                            title="View on block explorer"
                          >
                            <ExternalLink size={11} className="text-pink-500" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Incoming swaps indicator when paused */}
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
    </motion.div>
  );
}
