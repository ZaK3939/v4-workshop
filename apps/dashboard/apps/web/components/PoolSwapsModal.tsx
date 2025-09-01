import { useEffect, useRef, useState } from "react";
import { useRecentSwapsByPool } from "../hooks/useRecentSwapsByPool";
import {
  X,
  ExternalLink,
  ChevronDown,
  ArrowDownUp,
  Copy,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

// Helper function to format USD values
const formatUSD = (value: string): string => {
  const num = parseFloat(value);
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(4)}`;
  }
};

// Helper function to extract chain ID from the new format
const extractChainId = (id: string): string => {
  // Handle undefined or null id
  if (!id) return "130"; // Default to Unichain
  
  // If the ID contains an underscore, extract the part before it
  if (id.includes("_")) {
    const chainId = id.split("_")[0];
    return chainId || id; // Fallback to original id if split fails
  }
  return id;
};

// Helper function to extract pool address from the ID
const extractPoolAddress = (id: string): string => {
  // Handle undefined or null id
  if (!id) return "";
  
  // If the ID contains an underscore, extract the part after it
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

// Helper function to extract token address from the ID (removing chain ID prefix)
const extractTokenAddress = (id: string): string => {
  // Handle undefined or null id
  if (!id) return "";
  
  // If the ID contains an underscore, extract the part after it
  if (id.includes("_")) {
    const address = id.split("_")[1];
    return address || id;
  }
  return id;
};

// Format timestamp
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString();
};

// Format relative time (e.g., "2 minutes ago")
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const swapTime = new Date(parseInt(timestamp) * 1000);
  const diffMs = now.getTime() - swapTime.getTime();

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
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Network names mapping
const NETWORK_NAMES: Record<string, string> = {
  "130": "Unichain",
};

// Network slugs for Uniswap URLs
const NETWORK_SLUGS: Record<string, string> = {
  "1": "ethereum",
  "10": "optimism",
  "137": "polygon",
  "42161": "arbitrum",
  "8453": "base",
  "81457": "blast",
  "7777777": "zora",
};

interface PoolSwapsModalProps {
  poolId: string;
  poolName: string;
  token0: string;
  token1: string;
  onClose: () => void;
}

export function PoolSwapsModal({
  poolId,
  poolName,
  token0,
  token1,
  onClose,
}: PoolSwapsModalProps) {
  const { swaps, loading, error } = useRecentSwapsByPool(poolId);
  const [showAll, setShowAll] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedAddress) {
      const timer = setTimeout(() => {
        setCopiedAddress(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedAddress]);

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the modal
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
  };

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
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

  const poolAddress = extractPoolAddress(poolId);
  const chainId = extractChainId(poolId);
  const networkName = NETWORK_NAMES[chainId] || `Chain ${chainId}`;
  const networkSlug = NETWORK_SLUGS[chainId] || chainId;
  const uniswapPoolUrl = `https://app.uniswap.org/explore/pools/${networkSlug}/${poolAddress}`;

  // Get token names/symbols from the first swap if available
  const firstSwap = swaps?.Swap?.[0];
  const token0Name =
    firstSwap?.token0?.symbol || firstSwap?.token0?.name || token0;
  const token1Name =
    firstSwap?.token1?.symbol || firstSwap?.token1?.name || token1;
  const displayPoolName = poolName || `${token0Name}/${token1Name}`;

  const displayedSwaps = showAll
    ? swaps?.Swap || []
    : (swaps?.Swap || []).slice(0, 20);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        ref={modalRef}
        className="bg-background rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/50">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg font-medium">
              {swaps?.Swap
                ? `Recent Swaps (${swaps.Swap.length})`
                : "Recent Swaps"}
            </h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <a
                href={uniswapPoolUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <span>{displayPoolName}</span>
                <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100" />
              </a>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/50 min-w-[90px] text-center">
                {networkName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {loading && !swaps && (
            <div className="flex items-center justify-center h-40">
              <div className="animate-pulse text-muted-foreground">
                Loading swaps...
              </div>
            </div>
          )}

          {error && !swaps && (
            <div className="flex items-center justify-center h-40">
              <div className="text-red-500">{error}</div>
            </div>
          )}

          {!loading && !error && swaps?.Swap && swaps.Swap.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <div className="text-muted-foreground">
                No swaps found for this pool
              </div>
            </div>
          )}

          {swaps?.Swap && swaps.Swap.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium px-1">Swap Details</h3>

              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Time
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Transaction
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Amount USD
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Token Amounts
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Accounts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {displayedSwaps.map((swap) => {
                        const swapChainId = extractChainId(swap.chainId);
                        const blockExplorerUrl = `https://scope.sh/${swapChainId}/tx/${swap.transaction}`;
                        const amount0Value = parseFloat(swap.amount0);
                        const amount1Value = parseFloat(swap.amount1);
                        const isPositiveAmount0 = amount0Value > 0;
                        const isPositiveAmount1 = amount1Value > 0;

                        // Get token names or symbols, with fallbacks
                        const token0Name =
                          swap.token0.name ||
                          swap.token0.symbol ||
                          shortenAddress(swap.token0.id);
                        const token1Name =
                          swap.token1.name ||
                          swap.token1.symbol ||
                          shortenAddress(swap.token1.id);

                        // Extract token addresses without chain ID prefix
                        const token0Address = extractTokenAddress(
                          swap.token0.id
                        );
                        const token1Address = extractTokenAddress(
                          swap.token1.id
                        );

                        // Token explorer URLs - using 'address' endpoint instead of 'token'
                        const token0ExplorerUrl = `https://scope.sh/${swapChainId}/address/${token0Address}`;
                        const token1ExplorerUrl = `https://scope.sh/${swapChainId}/address/${token1Address}`;

                        return (
                          <tr
                            key={swap.id}
                            className="hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-3 sm:px-4 py-3 text-sm whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">
                                  {formatRelativeTime(swap.timestamp)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(swap.timestamp)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <a
                                href={blockExplorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
                              >
                                <span>{shortenAddress(swap.transaction)}</span>
                                <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                              </a>
                            </td>
                            <td className="px-3 sm:px-4 py-3 font-mono text-sm">
                              {formatUSD(swap.amountUSD)}
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <div
                                  className={`font-mono ${isPositiveAmount0 ? "text-green-500" : "text-red-500"}`}
                                >
                                  <a
                                    href={token0ExplorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    {`${amount0Value.toFixed(4)} ${token0Name}`}
                                    <ExternalLink className="w-2 h-2 opacity-70" />
                                  </a>
                                </div>
                                <div className="flex items-center justify-center">
                                  <ArrowDownUp className="w-3 h-3 opacity-50" />
                                </div>
                                <div
                                  className={`font-mono ${isPositiveAmount1 ? "text-green-500" : "text-red-500"}`}
                                >
                                  <a
                                    href={token1ExplorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    {`${amount1Value.toFixed(4)} ${token1Name}`}
                                    <ExternalLink className="w-2 h-2 opacity-70" />
                                  </a>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <div className="flex flex-col gap-1 text-xs font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    From:
                                  </span>
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="truncate">
                                      {shortenAddress(swap.origin)}
                                    </span>
                                    <a
                                      href={`https://scope.sh/${swapChainId}/address/${swap.origin}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-0.5 rounded hover:bg-secondary/50 transition-colors flex-shrink-0"
                                      title="View on explorer"
                                    >
                                      <ExternalLink className="w-2 h-2 opacity-70 hover:opacity-100" />
                                    </a>
                                    <button
                                      onClick={(e) =>
                                        copyToClipboard(swap.origin, e)
                                      }
                                      className="p-0.5 rounded hover:bg-secondary/50 transition-colors flex-shrink-0"
                                      title="Copy address"
                                    >
                                      {copiedAddress === swap.origin ? (
                                        <Check className="w-2 h-2 text-green-500" />
                                      ) : (
                                        <Copy className="w-2 h-2 opacity-70 hover:opacity-100" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    To:
                                  </span>
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="truncate">
                                      {shortenAddress(swap.sender)}
                                    </span>
                                    <a
                                      href={`https://scope.sh/${swapChainId}/address/${swap.sender}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-0.5 rounded hover:bg-secondary/50 transition-colors flex-shrink-0"
                                      title="View on explorer"
                                    >
                                      <ExternalLink className="w-2 h-2 opacity-70 hover:opacity-100" />
                                    </a>
                                    <button
                                      onClick={(e) =>
                                        copyToClipboard(swap.sender, e)
                                      }
                                      className="p-0.5 rounded hover:bg-secondary/50 transition-colors flex-shrink-0"
                                      title="Copy address"
                                    >
                                      {copiedAddress === swap.sender ? (
                                        <Check className="w-2 h-2 text-green-500" />
                                      ) : (
                                        <Copy className="w-2 h-2 opacity-70 hover:opacity-100" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {swaps.Swap.length > 20 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 group"
                >
                  <span className="text-sm font-medium">
                    {showAll
                      ? `Show Recent 20 Swaps`
                      : `Show All Swaps (${swaps.Swap.length})`}
                  </span>
                  <motion.div
                    animate={{ rotate: showAll ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
