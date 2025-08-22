"use client";

import { useState } from "react";
import { useStats } from "@/hooks/useStats";
import { AnimatedBar } from "@/components/AnimatedBar";
import StatsSummary from "@/components/StatsSummary";
import { TabsContainer } from "@/components/TabsContainer";
import { motion, AnimatePresence } from "framer-motion";
import { PoolsSummary } from "../components/PoolsSummary";
import { LogoHeader } from "@/components/LogoHeader";
import { TvlSummary } from "@/components/TvlSummary";
import { TvlAnimatedBar } from "@/components/TvlAnimatedBar";
import { PulseSwapsColumn } from "@/components/PulseSwapsColumn";
import { PulseLiquidityColumn } from "@/components/PulseLiquidityColumn";
import { HookPoolsSummary } from "@/components/HookPoolsSummary";
import { HookedPulseSwapsColumn } from "@/components/HookedPulseSwapsColumn";
import { HookedPulseLiquidityColumn } from "@/components/HookedPulseLiquidityColumn";
import { HooksSummary } from "@/components/HooksSummary";
import { HookAddressFilter } from "@/components/HookAddressFilter";

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

const TABS = [
  { id: "overview", label: "Swaps" },
  { id: "pulse", label: "Pulse" },
  { id: "tvl", label: "TVL" },
  { id: "pools", label: "Pools" },
  { id: "hook-pools", label: "Hook Pools" },
  { id: "hooks", label: "Hooks" },
  { id: "hooked-pulse", label: "Hooked Pulse" },
  { id: "v4", label: "V4", externalLink: "https://v4.xyz" },
];

type FactoryStat = {
  numberOfSwaps: string;
  poolCount: string;
  id: string;
  owner: string;
  totalFeesETH: string;
  totalFeesUSD: string;
  totalValueLockedETH: string;
  totalValueLockedETHUntracked: string;
  totalValueLockedUSD: string;
  totalValueLockedUSDUntracked: string;
  totalVolumeETH: string;
  totalVolumeUSD: string;
  untrackedVolumeUSD: string;
};

export default function Page() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAllNetworks, setShowAllNetworks] = useState(false);
  const [hookFilter, setHookFilter] = useState("");
  const { stats, error } = useStats();

  // Handle tab changes, with special case for Pulse tab
  const handleTabChange = (tabId: string) => {
    // Check if the tab has an external link
    const tab = TABS.find(tab => tab.id === tabId);
    if (tab?.externalLink) {
      window.open(tab.externalLink, '_blank');
      return;
    }

    setActiveTab(tabId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-svh">
        <div className="text-center space-y-4">
          <div className="text-red-500">{error}</div>
          {error.includes("Retrying") && (
            <div className="animate-pulse text-muted-foreground">
              Attempting to reconnect...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-svh">
        Loading...
      </div>
    );
  }

  const sortedStats = [...stats.Factory].sort(
    (a, b) => parseInt(b.numberOfSwaps) - parseInt(a.numberOfSwaps)
  ) as FactoryStat[];

  const totalSwaps = sortedStats.reduce(
    (acc, stat) => acc + parseInt(stat.numberOfSwaps),
    0
  );
  const totalPools = sortedStats.reduce(
    (acc, stat) => acc + parseInt(stat.poolCount),
    0
  );

  const globalStats = {
    totalSwaps,
    totalPools,
    avgSwapsPerPool: totalPools > 0 ? totalSwaps / totalPools : 0,
  };

  const networkStats = sortedStats.map((stat) => {
    const chainId = extractChainId(stat.id);
    return {
      id: stat.id,
      name: NETWORK_NAMES[chainId] || `Chain ${stat.id}`,
      swaps: parseInt(stat.numberOfSwaps),
      pools: parseInt(stat.poolCount),
      avgSwapsPerPool:
        parseInt(stat.poolCount) > 0
          ? parseInt(stat.numberOfSwaps) / parseInt(stat.poolCount)
          : 0,
    };
  });

  // Calculate TVL-related stats
  const totalTVL = sortedStats.reduce(
    (acc, stat) => acc + parseFloat(stat.totalValueLockedUSD || "0"),
    0
  );

  const totalVolume = sortedStats.reduce(
    (acc, stat) => acc + parseFloat(stat.totalVolumeUSD || "0"),
    0
  );

  const totalFees = sortedStats.reduce(
    (acc, stat) => acc + parseFloat(stat.totalFeesUSD || "0"),
    0
  );

  const tvlNetworkStats = sortedStats.map((stat) => {
    const chainId = extractChainId(stat.id);
    return {
      id: stat.id,
      name: NETWORK_NAMES[chainId] || `Chain ${chainId}`,
      tvl: parseFloat(stat.totalValueLockedUSD || "0"),
      volume: parseFloat(stat.totalVolumeUSD || "0"),
    };
  });

  return (
    <div className="flex flex-col min-h-svh">
      <div className="flex items-center justify-center flex-1 px-2 sm:px-4">
        <div className="w-full max-w-full sm:max-w-3xl">
          <LogoHeader />
          <TabsContainer
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          >
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <StatsSummary
                    factoryStats={sortedStats}
                  />
                  <div className="space-y-3">
                    {sortedStats.map((stat) => {
                      const chainId = extractChainId(stat.id);
                      return (
                        <AnimatedBar
                          key={stat.id}
                          label={
                            NETWORK_NAMES[chainId] || `Chain ${chainId}`
                          }
                          value={parseInt(stat.numberOfSwaps)}
                          maxValue={totalSwaps}
                          pools={parseInt(stat.poolCount)}
                          maxPools={totalPools}
                          mode="overview"
                        />
                      );
                    })}
                  </div>
                </motion.div>
              )}
              {activeTab === "pulse" && (
                <motion.div
                  key="pulse"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left column: Recent Swaps */}
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <PulseSwapsColumn />
                      </div>

                      {/* Right column: Liquidity Activity */}
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <PulseLiquidityColumn />
                      </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground mt-2">
                      <p>
                        Recent data from Uniswap V4 pools on Unichain
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === "tvl" && (
                <motion.div
                  key="tvl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    <TvlSummary
                      globalStats={{
                        totalTVL,
                        totalVolume,
                        totalFees,
                      }}
                      networkStats={tvlNetworkStats}
                    />
                    <div className="space-y-3">
                      {tvlNetworkStats
                        .sort((a, b) => b.tvl - a.tvl)
                        .map((stat) => (
                          <TvlAnimatedBar
                            key={stat.id}
                            label={stat.name}
                            tvl={stat.tvl}
                            maxTvl={totalTVL}
                            volume={stat.volume}
                            maxVolume={totalVolume}
                          />
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === "pools" && (
                <motion.div
                  key="pools"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Pools</h2>
                    <PoolsSummary />
                  </div>
                </motion.div>
              )}
              {activeTab === "hook-pools" && (
                <motion.div
                  key="hook-pools"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Hook Pools</h2>
                      <HookAddressFilter
                        value={hookFilter}
                        onChange={setHookFilter}
                        placeholder="Filter by hook address..."
                      />
                    </div>
                    <HookPoolsSummary hookFilter={hookFilter} />
                  </div>
                </motion.div>
              )}
              {activeTab === "hooks" && (
                <motion.div
                  key="hooks"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Hooks</h2>
                      <HookAddressFilter
                        value={hookFilter}
                        onChange={setHookFilter}
                        placeholder="Filter by hook address..."
                      />
                    </div>
                    <HooksSummary hookFilter={hookFilter} />
                  </div>
                </motion.div>
              )}
              {activeTab === "hooked-pulse" && (
                <motion.div
                  key="hooked-pulse"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Hooked Pulse</h2>
                    <p className="text-sm text-muted-foreground">
                      Real-time activity from pools with hooks on Unichain
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left column: Hook Swaps */}
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <HookedPulseSwapsColumn />
                      </div>

                      {/* Right column: Hook Liquidity Activity */}
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <HookedPulseLiquidityColumn />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContainer>
        </div>
      </div>
      {/* <footer className="mt-8 text-center text-sm text-muted-foreground pb-4">
        <p>
          Data indexed by{" "}
          <a
            href="https://docs.envio.dev/docs/HyperIndex/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary transition-colors"
          >
            HyperIndex
          </a>{" "}
          on{" "}
          <a
            href="https://envio.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary transition-colors"
          >
            envio.dev
          </a>
        </p>
      </footer> */}
    </div>
  );
}
