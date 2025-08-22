import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { graphqlClient } from "@/lib/graphql";
import { Copy, ExternalLink, Check } from "lucide-react";

interface Token {
  id: string;
  symbol: string;
  name: string;
}

interface Pool {
  id: string;
  name: string;
  token0: Token;
  token1: Token;
  chainId: string;
  createdAtTimestamp: string;
  hooks: string;
  totalValueLockedUSD: string;
  uniqueId?: string; // Optional unique identifier to prevent key conflicts
  animationId?: number; // Added to control sequence animations
  txCount?: string;
  feesUSD?: string;
  volumeUSD?: string;
  untrackedVolumeUSD?: string;
  feesUSDUntracked?: string;
}

interface RecentPoolsResponse {
  Pool: Pool[];
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

// Helper function to extract pool address from the ID
const extractPoolAddress = (id: string): string => {
  // If the ID contains an underscore, extract the part after it
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

// Generate a guaranteed unique ID for each pool
const generateUniqueId = (poolId: string): string => {
  // Combine pool ID with timestamp (ms) + performance.now() (sub-ms precision) and random string
  const timestamp = Date.now();
  const nanoTime =
    typeof performance !== "undefined"
      ? performance.now().toString().replace(".", "")
      : "0";
  const random = Math.random().toString(36).substring(2, 10);

  return `${poolId}_${timestamp}_${nanoTime}_${random}`;
};

// Format timestamp
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString();
};

// Format relative time (e.g., "2 minutes ago")
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const poolTime = new Date(parseInt(timestamp) * 1000);
  const diffMs = now.getTime() - poolTime.getTime();

  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec} ${diffSec === 1 ? "second" : "seconds"} ago`;
  }

  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  }

  // Convert to hours
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  }

  // Convert to days
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ${diffDay === 1 ? "day" : "days"} ago`;
};

// Format address to be shorter
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Global recent pools query
const RECENT_POOLS_QUERY = `
  query recentPools($limit: Int!) {
    Pool(
      order_by: {createdAtTimestamp: desc}, 
      limit: $limit
    ) {
      id
      name
      token0 {
        id
        symbol
        name
      }
      token1 {
        id
        symbol
        name
      }
      chainId
      createdAtTimestamp
      hooks
      totalValueLockedUSD
      txCount
      feesUSD
      volumeUSD
      untrackedVolumeUSD
      feesUSDUntracked
    }
  }
`;

// Helper function to check if an address is the zero address
const isZeroAddress = (address: string): boolean => {
  if (!address) return true;

  // Remove '0x' prefix if present
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;

  // Check if the address consists only of zeros or is empty
  return (
    cleanAddress.length === 0 ||
    /^0+$/.test(cleanAddress) ||
    address === "0x0000000000000000000000000000000000000000"
  );
};

// Get block explorer URL based on chain ID
const getBlockExplorerUrl = (chainId: string, address: string): string => {
  const explorers: Record<string, string> = {
    "1": "https://etherscan.io/address/",
    "10": "https://optimistic.etherscan.io/address/",
    "137": "https://polygonscan.com/address/",
    "42161": "https://arbiscan.io/address/",
    "8453": "https://basescan.org/address/",
    "81457": "https://blastscan.io/address/",
    "7777777": "https://explorer.zora.energy/address/",
    "56": "https://bscscan.com/address/",
    "43114": "https://snowtrace.io/address/",
    "57073": "https://inkscan.io/address/",
    "1868": "https://sonscan.io/address/",
    "130": "https://uniscan.xyz/address/",
  };

  const baseUrl = explorers[chainId] || "https://etherscan.io/address/"; // Default to Ethereum
  return `${baseUrl}${address}`;
};

export function RecentPoolsPopup({ isVisible }: { isVisible: boolean }) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [pendingPools, setPendingPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const prevPoolsRef = useRef<Pool[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const animationCounterRef = useRef<number>(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedText) {
      const timer = setTimeout(() => {
        setCopiedText(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  // Add pool animation one by one
  const processNextPendingPool = useCallback(() => {
    if (isPaused) return;

    setPendingPools((current) => {
      if (current.length === 0) return current;

      const nextPool = current[0];
      if (!nextPool) return current;

      const remainingPools = current.slice(1);

      // Add the next pool to the main list
      setPools((prevPools) => {
        // Skip if we already have this pool (by ID)
        if (prevPools.some((existing) => existing.id === nextPool.id)) {
          return prevPools;
        }

        // Add the new pool, then sort all pools by creation timestamp (newest first)
        const combinedPools = [nextPool, ...prevPools];

        // Important: Sort again to ensure newest pools are always first
        const sortedPools = combinedPools.sort(
          (a, b) =>
            parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp)
        );

        // Keep only the latest 20 pools
        return sortedPools.slice(0, 20) as Pool[];
      });

      // If there are more pending pools, schedule the next one
      if (remainingPools.length > 0) {
        // Adjust the timeouts based on number of remaining pools
        // More pools = faster animations to catch up
        const timeout = Math.max(50, 250 - remainingPools.length * 10);
        animationTimeoutRef.current = setTimeout(
          processNextPendingPool,
          timeout
        );
      }

      return remainingPools;
    });
  }, [isPaused]);

  // Handle new pools coming in
  useEffect(() => {
    if (pendingPools.length > 0 && !isPaused && !animationTimeoutRef.current) {
      animationTimeoutRef.current = setTimeout(() => {
        processNextPendingPool();
        animationTimeoutRef.current = null;
      }, 100);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, [pendingPools, isPaused, processNextPendingPool]);

  // Fetch recent pools
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    const fetchData = async () => {
      if (isPaused) return; // Don't fetch if paused

      try {
        const data = await graphqlClient.request<RecentPoolsResponse>(
          RECENT_POOLS_QUERY,
          {
            limit: 50, // Fetch more to have a good stream
          }
        );

        if (!isMounted) return;

        // Create a mutable copy of the data.Pool array and sort it directly
        const sortedPoolsArray = [...data.Pool].sort(
          (a, b) =>
            parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp)
        );

        // Add a unique identifier to each pool
        const poolsWithIds = sortedPoolsArray.map((pool) => ({
          ...pool,
          uniqueId: generateUniqueId(pool.id),
        }));

        // Double-check that the order is maintained
        poolsWithIds.sort(
          (a, b) =>
            parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp)
        );

        // Find truly new pools (not in previous batch)
        const newPools = poolsWithIds.filter(
          (pool) =>
            !prevPoolsRef.current.some((prevPool) => prevPool.id === pool.id)
        );

        // Add animation sequence IDs to new pools
        const newPoolsWithAnimationIds = newPools.map((pool, index) => ({
          ...pool,
          animationId: animationCounterRef.current + index,
        }));

        // Update counter for next batch
        animationCounterRef.current += newPools.length;

        // If we have new pools, add them to pending queue
        if (newPoolsWithAnimationIds.length > 0) {
          setPendingPools((current) => {
            // Create a Set of existing IDs to avoid duplicates
            const existingIds = new Set(current.map((pool) => pool.id));

            // Only add pools that aren't already in the pending queue
            const filteredNewPools = newPoolsWithAnimationIds.filter(
              (pool) => !existingIds.has(pool.id)
            );

            // Sort the combined pending pools by creation timestamp
            const combinedPools = [...current, ...filteredNewPools];
            return combinedPools.sort(
              (a, b) =>
                parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp)
            );
          });
        }

        // Update reference of previous pools for next comparison
        prevPoolsRef.current = poolsWithIds;

        // On initial load, show some pools immediately
        if (loading && pools.length === 0) {
          // Show the 20 most recent pools immediately (already sorted)
          setPools(poolsWithIds.slice(0, 20));
          setLoading(false);
        } else if (!loading) {
          // For subsequent loads, merge with existing pools and resort
          setPools((currentPools) => {
            // Combine existing and new pools, removing duplicates
            const poolIds = new Set(currentPools.map((p) => p.id));
            const newUniquePools = poolsWithIds.filter(
              (p) => !poolIds.has(p.id)
            );

            const combinedPools = [...currentPools, ...newUniquePools];

            // Sort again by creation timestamp (newest first)
            const sortedPools = combinedPools.sort(
              (a, b) =>
                parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp)
            );

            // Keep only the latest 20 pools
            return sortedPools.slice(0, 20);
          });
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching recent pools:", err);
        if (isMounted) {
          setError("Failed to fetch recent pools");
        }
      }
    };

    fetchData();
    // Poll for new pools every 3 seconds
    const interval = setInterval(fetchData, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isVisible, loading, pools.length, isPaused]);

  // Get pool timestamp in readable format
  const getPoolTimestamp = (timestamp: string) => {
    const poolTime = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - poolTime.getTime()) / 1000);

    if (diffSeconds < 5) {
      return "now";
    } else if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else {
      return poolTime.toLocaleTimeString();
    }
  };

  // Copy text to clipboard with feedback
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedText(text);
        console.log("Copied to clipboard:", text);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  };

  // Get Uniswap pool URL
  const getUniswapPoolUrl = (chainId: string, poolAddress: string): string => {
    const networkSlugs: Record<string, string> = {
      "1": "ethereum",
      "10": "optimism",
      "137": "polygon",
      "42161": "arbitrum",
      "8453": "base",
      "81457": "blast",
      "7777777": "zora",
    };

    const networkSlug = networkSlugs[chainId] || chainId;
    return `https://app.uniswap.org/explore/pools/${networkSlug}/${poolAddress}`;
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
        <h3 className="text-sm font-medium">Real-time Pools</h3>
        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="bg-pink-500/10 text-pink-500 text-xs px-2 py-0.5 rounded-full">
              Paused
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {pendingPools.length > 0 ? (
              <span className="text-pink-500/80">
                {pendingPools.length} pools incoming
              </span>
            ) : (
              `${pools.length} recent pools`
            )}
          </div>
        </div>
      </div>

      <div
        className="max-h-[400px] overflow-y-auto p-2 relative"
        style={{ scrollBehavior: "smooth" }}
      >
        {loading && pools.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center text-sm">{error}</div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {pools
                .slice() // Create a copy to avoid mutating the original array
                .sort(
                  (a, b) =>
                    parseInt(b.createdAtTimestamp) -
                    parseInt(a.createdAtTimestamp)
                )
                .map((pool) => {
                  if (!pool || !pool.uniqueId) return null; // Skip invalid pools

                  const chainId = extractChainId(pool.chainId);
                  const poolAddress = extractPoolAddress(pool.id);
                  const networkName =
                    NETWORK_NAMES[chainId] || `Chain ${chainId}`;
                  const formattedTVL = formatUSD(pool.totalValueLockedUSD);
                  const timestamp = getPoolTimestamp(pool.createdAtTimestamp);
                  const hasHook = pool.hooks && !isZeroAddress(pool.hooks);

                  // Get volume and fees data
                  const volumeUSD =
                    parseFloat(pool.volumeUSD || "0") > 0
                      ? pool.volumeUSD || "0"
                      : pool.untrackedVolumeUSD || "0";

                  const feesUSD =
                    parseFloat(pool.feesUSD || "0") > 0
                      ? pool.feesUSD || "0"
                      : pool.feesUSDUntracked || "0";

                  const formattedVolume = formatUSD(volumeUSD);
                  const formattedFees = formatUSD(feesUSD);

                  // Get pool name from token symbols
                  const token0Symbol = pool.token0?.symbol || "Unknown";
                  const token1Symbol = pool.token1?.symbol || "Unknown";
                  const poolName = `${token0Symbol}/${token1Symbol}`;

                  return (
                    <motion.div
                      key={`pool_${pool.uniqueId}`}
                      className="bg-secondary/30 rounded-lg p-2.5 overflow-hidden hover:bg-secondary/50 transition-colors group"
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

                      <div className="flex">
                        {/* Left Column - Pool Name and Details */}
                        <div className="flex-1 flex flex-col pr-3">
                          {/* Pool Name */}
                          <div className="font-medium text-sm truncate mb-1">
                            {poolName}
                          </div>

                          {/* Pool ID and Hook - Always visible */}
                          <div className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1 truncate">
                              <span className="whitespace-nowrap font-medium">
                                Pool ID:
                              </span>
                              <span className="font-mono truncate">
                                {shortenAddress(poolAddress)}
                              </span>
                              <div className="flex flex-shrink-0">
                                <button
                                  className="p-0.5 hover:bg-pink-500/10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(poolAddress);
                                  }}
                                  title="Copy pool ID"
                                >
                                  {copiedText === poolAddress ? (
                                    <Check
                                      size={10}
                                      className="text-green-500"
                                    />
                                  ) : (
                                    <Copy size={10} className="text-pink-500" />
                                  )}
                                </button>
                                <a
                                  href={getUniswapPoolUrl(chainId, poolAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-0.5 hover:bg-pink-500/10 rounded-full"
                                  onClick={(e) => e.stopPropagation()}
                                  title="View on Uniswap"
                                >
                                  <ExternalLink
                                    size={10}
                                    className="text-pink-500"
                                  />
                                </a>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 truncate">
                              <span className="whitespace-nowrap font-medium">
                                Hook:
                              </span>
                              {hasHook && pool.hooks ? (
                                <div className="flex items-center truncate">
                                  <span className="font-mono truncate">
                                    {shortenAddress(pool.hooks)}
                                  </span>
                                  <div className="flex ml-1 flex-shrink-0">
                                    <button
                                      className="p-0.5 hover:bg-pink-500/10 rounded-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (pool.hooks) {
                                          copyToClipboard(pool.hooks);
                                        }
                                      }}
                                      title="Copy hook address"
                                    >
                                      {pool.hooks &&
                                        copiedText === pool.hooks ? (
                                        <Check
                                          size={10}
                                          className="text-green-500"
                                        />
                                      ) : (
                                        <Copy
                                          size={10}
                                          className="text-pink-500"
                                        />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs">No Hook</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Column - Metrics Square */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 min-w-[120px]">
                          <div className="flex flex-col items-end">
                            <div className="text-[10px] text-muted-foreground">
                              TVL
                            </div>
                            <div className="text-xs font-mono text-pink-500">
                              {formattedTVL}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-[10px] text-muted-foreground">
                              Swaps
                            </div>
                            <div className="text-xs font-mono">
                              {pool.txCount
                                ? parseInt(pool.txCount).toLocaleString()
                                : "0"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-[10px] text-muted-foreground">
                              Volume
                            </div>
                            <div className="text-xs font-mono">
                              {formattedVolume}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-[10px] text-muted-foreground">
                              Fees
                            </div>
                            <div className="text-xs font-mono">
                              {formattedFees}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Incoming pools indicator when paused */}
            {isPaused && pendingPools.length > 0 && (
              <motion.div
                className="bg-pink-500/10 text-center py-2 px-4 rounded-md text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-pulse h-2 w-2 rounded-full bg-pink-500"></div>
                  <span>{pendingPools.length} new pools waiting</span>
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
