import { motion, animate, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TvlSummaryProps {
  globalStats: {
    totalTVL: number;
    totalVolume: number;
    totalFees: number;
  };
  networkStats: {
    id: string;
    name: string;
    tvl: number;
    volume: number;
  }[];
}

export function TvlSummary({ globalStats, networkStats }: TvlSummaryProps) {
  const tvlRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const feesRef = useRef<HTMLDivElement>(null);

  const previousValues = useRef({
    tvl: globalStats.totalTVL,
    volume: globalStats.totalVolume,
    fees: globalStats.totalFees,
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

    const cleanups = [
      animateValue(
        tvlRef,
        previousValues.current.tvl,
        globalStats.totalTVL,
        (v) => `$${Math.round(v).toLocaleString()}`
      ),
      animateValue(
        volumeRef,
        previousValues.current.volume,
        globalStats.totalVolume,
        (v) => `$${Math.round(v).toLocaleString()}`
      ),
      animateValue(
        feesRef,
        previousValues.current.fees,
        globalStats.totalFees,
        (v) => `$${Math.round(v).toLocaleString()}`
      ),
    ];

    previousValues.current = {
      tvl: globalStats.totalTVL,
      volume: globalStats.totalVolume,
      fees: globalStats.totalFees,
    };

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [globalStats]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
        <div className="text-sm text-muted-foreground">Total TVL</div>
        <motion.div
          ref={tvlRef}
          className="text-md font-mono tabular-nums"
          animate={{
            color:
              previousValues.current.tvl < globalStats.totalTVL
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          ${globalStats.totalTVL.toLocaleString()}
        </motion.div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
        <div className="text-sm text-muted-foreground">Total Volume</div>
        <motion.div
          ref={volumeRef}
          className="text-xs font-mono tabular-nums"
          animate={{
            color:
              previousValues.current.volume < globalStats.totalVolume
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          ${globalStats.totalVolume.toLocaleString()}
        </motion.div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
        <div className="text-sm text-muted-foreground">Total Fees</div>
        <motion.div
          ref={feesRef}
          className="text-md font-mono tabular-nums"
          animate={{
            color:
              previousValues.current.fees < globalStats.totalFees
                ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                : "inherit",
          }}
          transition={{ duration: 0.3 }}
        >
          ${globalStats.totalFees.toLocaleString()}
        </motion.div>
      </div>
    </div>
  );
}
