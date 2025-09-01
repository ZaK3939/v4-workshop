import { motion, animate, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import React from 'react';

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

interface StatsSummaryProps {
  factoryStats: FactoryStat[];
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ factoryStats }) => {
  const swapsRef = useRef<HTMLDivElement>(null);
  const poolsRef = useRef<HTMLDivElement>(null);
  const avgRef = useRef<HTMLDivElement>(null);

  const previousValues = useRef({
    swaps: 0,
    pools: 0,
    avg: 0,
  });

  useEffect(() => {
    const animateValue = (
      ref: React.RefObject<HTMLDivElement>,
      start: number,
      end: number,
      format: (value: number) => string
    ) => {
      if (!ref.current) return;

      const controls = animate(start, end, {
        duration: 1.2,
        ease: [0.32, 0.72, 0, 1],
        onUpdate(value) {
          if (ref.current) {
            ref.current.textContent = format(value);
          }
        },
      });

      return controls.stop;
    };

    const totalPools = factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0);
    const totalSwaps = factoryStats.reduce((total, stat) => total + parseInt(stat.numberOfSwaps), 0);
    const avgSwapsPerPool = totalPools > 0 ? totalSwaps / totalPools : 0;

    const cleanups = [
      animateValue(
        swapsRef,
        previousValues.current.swaps,
        totalSwaps,
        (v) => Math.round(v).toLocaleString()
      ),
      animateValue(
        poolsRef,
        previousValues.current.pools,
        totalPools,
        (v) => Math.round(v).toLocaleString()
      ),
      animateValue(
        avgRef,
        previousValues.current.avg,
        avgSwapsPerPool,
        (v) => v.toFixed(1)
      ),
    ];

    previousValues.current = {
      swaps: totalSwaps,
      pools: totalPools,
      avg: avgSwapsPerPool,
    };

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [factoryStats]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div
        className="p-4 rounded-lg bg-secondary/50 space-y-1 relative transition-all duration-200 group z-20"
      >
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          Total Swaps
        </div>
        <motion.div
          ref={swapsRef}
          className="text-2xl font-mono tabular-nums"
          animate={{
            color:
              previousValues.current.swaps < factoryStats.reduce((total, stat) => total + parseInt(stat.numberOfSwaps), 0)
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          {factoryStats.reduce((total, stat) => total + parseInt(stat.numberOfSwaps), 0).toLocaleString()}
        </motion.div>
      </div>

      <div
        className="p-4 rounded-lg bg-secondary/50 space-y-1 relative transition-all duration-200 group z-20"
      >
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          Total Pools
        </div>
        <motion.div
          ref={poolsRef}
          className="text-2xl font-mono tabular-nums"
          animate={{
            scale:
              previousValues.current.pools < factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0)
                ? [1, 1.06, 1]
                : 1,
            color:
              previousValues.current.pools < factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0)
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          {factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0).toLocaleString()}
        </motion.div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
        <div className="text-sm text-muted-foreground">Avg Swaps/Pool</div>
        <motion.div
          ref={avgRef}
          className="text-2xl font-mono tabular-nums"
          animate={{
            color:
              previousValues.current.avg < (factoryStats.reduce((total, stat) => total + parseInt(stat.numberOfSwaps), 0) /
                (factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0) || 1))
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          {(factoryStats.reduce((total, stat) => total + parseInt(stat.numberOfSwaps), 0) /
            (factoryStats.reduce((total, stat) => total + parseInt(stat.poolCount), 0) || 1)).toFixed(1)}
        </motion.div>
      </div>
    </div>
  );
};

export default StatsSummary;
