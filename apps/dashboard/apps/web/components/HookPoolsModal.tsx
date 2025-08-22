import { useEffect, useRef } from "react";
import { X, ExternalLink, Code, Info, DollarSign, Activity, Clock } from "lucide-react";
import { motion } from "framer-motion";

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

// Format timestamp
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
};

interface HookPoolsModalProps {
  pool: any;
  onClose: () => void;
}

export function HookPoolsModal({ pool, onClose }: HookPoolsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  const poolAddress = extractPoolAddress(pool.id);
  const poolUrl = `https://app.uniswap.org/explore/pools/unichain/${poolAddress}`;
  const hookUrl = `https://hookrank.io/130/${pool.hooks.toLowerCase()}`;
  const poolExplorerUrl = `https://uniscan.xyz/address/${poolAddress}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        ref={modalRef}
        className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div>
            <h2 className="text-lg font-semibold">Hook Pool Details</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {pool.name || `${pool.token0}/${pool.token1}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Pool Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4" />
              Pool Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Pool Address</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-sm">{shortenAddress(poolAddress)}</span>
                    <a
                      href={poolExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hook Address</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-sm">{shortenAddress(pool.hooks)}</span>
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
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Fee Tier</p>
                  <p className="font-medium text-sm mt-1">{formatFee(pool.feeTier)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm mt-1">{formatTimestamp(pool.createdAtTimestamp)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Pool Statistics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="w-3 h-3" />
                  <span>Total Value Locked</span>
                </div>
                <div className="text-xl font-semibold">{formatUSD(pool.totalValueLockedUSD)}</div>
              </div>
              <div className="bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Activity className="w-3 h-3" />
                  <span>Total Volume</span>
                </div>
                <div className="text-xl font-semibold">{formatUSD(pool.volumeUSD)}</div>
              </div>
              <div className="bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  <span>Total Swaps</span>
                </div>
                <div className="text-xl font-semibold">{parseInt(pool.txCount).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Hook Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Code className="w-4 h-4" />
              Hook Details
            </h3>
            <div className="bg-secondary/20 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">Hook Contract</p>
              <div className="font-mono text-sm break-all">{pool.hooks}</div>
              <div className="mt-4 flex gap-2">
                <a
                  href={hookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Contract
                </a>
                <a
                  href={poolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Uniswap
                </a>
              </div>
            </div>
          </div>

          {/* Fees Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Fee Information</h3>
            <div className="bg-secondary/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Fees Collected</span>
                <span className="font-mono font-medium">{formatUSD(pool.feesUSD)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}