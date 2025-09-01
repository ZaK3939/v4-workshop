import { motion, animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface HookStatsSummaryProps {
  globalStats: {
    totalSwaps: number;
    hookedSwaps: number;
    totalPools: number;
    hookedPools: number;
  };
}

export function HookStatsSummary({ globalStats }: HookStatsSummaryProps) {
  const hookedSwapsRef = useRef<HTMLDivElement>(null);
  const nonHookedSwapsRef = useRef<HTMLDivElement>(null);
  const hookedPoolsRef = useRef<HTMLDivElement>(null);
  const nonHookedPoolsRef = useRef<HTMLDivElement>(null);

  const previousValues = useRef({
    hookedSwaps: 0,
    nonHookedSwaps: 0,
    hookedPools: 0,
    nonHookedPools: 0,
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

    const nonHookedSwaps = globalStats.totalSwaps - globalStats.hookedSwaps;
    const nonHookedPools = globalStats.totalPools - globalStats.hookedPools;

    const cleanups = [
      animateValue(
        hookedSwapsRef,
        previousValues.current.hookedSwaps,
        globalStats.hookedSwaps,
        (v) => Math.round(v).toLocaleString()
      ),
      animateValue(
        nonHookedSwapsRef,
        previousValues.current.nonHookedSwaps,
        nonHookedSwaps,
        (v) => Math.round(v).toLocaleString()
      ),
      animateValue(
        hookedPoolsRef,
        previousValues.current.hookedPools,
        globalStats.hookedPools,
        (v) => Math.round(v).toLocaleString()
      ),
      animateValue(
        nonHookedPoolsRef,
        previousValues.current.nonHookedPools,
        nonHookedPools,
        (v) => Math.round(v).toLocaleString()
      ),
    ];

    previousValues.current = {
      hookedSwaps: globalStats.hookedSwaps,
      nonHookedSwaps,
      hookedPools: globalStats.hookedPools,
      nonHookedPools,
    };

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [globalStats]);

  const hookedSwapsPercent =
    (globalStats.hookedSwaps / globalStats.totalSwaps) * 100;
  const hookedPoolsPercent =
    (globalStats.hookedPools / globalStats.totalPools) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div className="p-4 rounded-lg bg-secondary/50">
        <div className="text-sm text-muted-foreground mb-2">Swaps</div>
        <div className="flex justify-between items-baseline mb-3">
          <motion.div
            ref={hookedSwapsRef}
            className="text-2xl font-mono tabular-nums"
            animate={{
              color:
                previousValues.current.hookedSwaps < globalStats.hookedSwaps
                  ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                  : "inherit",
            }}
            transition={{ duration: 0.3 }}
          >
            {globalStats.hookedSwaps.toLocaleString()}
          </motion.div>
          <motion.div
            ref={nonHookedSwapsRef}
            className="text-2xl font-mono tabular-nums"
          >
            {(
              globalStats.totalSwaps - globalStats.hookedSwaps
            ).toLocaleString()}
          </motion.div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              initial={{ width: 0 }}
              animate={{
                width: `${hookedSwapsPercent}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-primary">{`${hookedSwapsPercent.toFixed(1)}% hooked`}</span>
            <span className="text-muted-foreground">{`${(100 - hookedSwapsPercent).toFixed(1)}% non-hooked`}</span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/50">
        <div className="text-sm text-muted-foreground mb-2">Pools</div>
        <div className="flex justify-between items-baseline mb-3">
          <motion.div
            ref={hookedPoolsRef}
            className="text-2xl font-mono tabular-nums"
            animate={{
              color:
                previousValues.current.hookedPools < globalStats.hookedPools
                  ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                  : "inherit",
            }}
            transition={{ duration: 0.3 }}
          >
            {globalStats.hookedPools.toLocaleString()}
          </motion.div>
          <motion.div
            ref={nonHookedPoolsRef}
            className="text-2xl font-mono tabular-nums"
          >
            {(
              globalStats.totalPools - globalStats.hookedPools
            ).toLocaleString()}
          </motion.div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              initial={{ width: 0 }}
              animate={{
                width: `${hookedPoolsPercent}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-primary">{`${hookedPoolsPercent.toFixed(1)}% hooked`}</span>
            <span className="text-muted-foreground">{`${(100 - hookedPoolsPercent).toFixed(1)}% non-hooked`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
