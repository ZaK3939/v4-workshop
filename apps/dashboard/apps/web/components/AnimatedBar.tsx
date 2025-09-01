"use client";

import { motion, useSpring, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface AnimatedBarProps {
  label: string;
  value: number;
  maxValue: number;
  pools: number;
  maxPools: number;
  mode?: "overview" | "hooks";
  hookedSwaps?: number;
  hookedPools?: number;
}

export function AnimatedBar({
  label,
  value,
  maxValue,
  pools,
  maxPools,
  mode = "overview",
  hookedSwaps,
  hookedPools,
}: AnimatedBarProps) {
  const numberRef = useRef<HTMLDivElement>(null);
  const hookedSwapsNumberRef = useRef<HTMLDivElement>(null);
  const totalSwapsNumberRef = useRef<HTMLDivElement>(null);
  const hookedPoolsNumberRef = useRef<HTMLDivElement>(null);
  const totalPoolsNumberRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef({
    value,
    hookedSwaps: hookedSwaps || 0,
    hookedPools: hookedPools || 0,
  });
  const width = (value / maxValue) * 100;
  const poolsWidth = (pools / maxPools) * 100;

  // More responsive spring animation for the bar
  const springValue = useSpring(0, {
    stiffness: 80, // Increased stiffness for more "snappy" movement
    damping: 12, // Reduced damping for more "bounce"
    mass: 0.3, // Reduced mass for quicker response
  });
  const barWidth = useTransform(springValue, [0, 100], ["0%", "100%"]);

  useEffect(() => {
    springValue.set(width);
  }, [width, springValue]);

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    const controls = animate(previousValueRef.current.value, value, {
      duration: 1.2, // Slightly longer duration
      ease: [0.32, 0.72, 0, 1], // Custom easing for more "punch"
      onUpdate(value) {
        node.textContent = Math.round(value).toLocaleString();
      },
    });

    previousValueRef.current.value = value;
    return () => controls.stop();
  }, [value]);

  if (mode === "overview") {
    return (
      <motion.div
        layout
        className="flex items-center gap-4 w-full group relative z-10"
      >
        <div className="w-24 text-sm font-mono">{label}</div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              style={{ width: `${width}%` }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: "-100%" }}
                animate={{
                  x: "100%",
                  transition: {
                    repeat: Infinity,
                    duration: 2,
                    ease: "linear",
                  },
                }}
              />
            </motion.div>
          </div>
          <div className="h-1 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              style={{ width: `${poolsWidth}%` }}
            />
          </div>
        </div>
        <div className="w-32 text-right space-y-1">
          <div className="flex justify-end items-center gap-1">
            <motion.div
              ref={numberRef}
              className="font-mono tabular-nums"
              animate={{
                scale:
                  value > previousValueRef.current.value ? [1, 1.06, 1] : 1,
                color:
                  value > previousValueRef.current.value
                    ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                    : "inherit",
              }}
              transition={{ duration: 0.3 }}
            >
              {value.toLocaleString()}
            </motion.div>
            <span className="text-xs text-muted-foreground">swaps</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {pools.toLocaleString()} pools
          </div>
        </div>
      </motion.div>
    );
  }

  // Hooks mode
  const hookedSwapsPercent = ((hookedSwaps || 0) / value) * 100;
  const hookedPoolsPercent = ((hookedPools || 0) / pools) * 100;

  return (
    <motion.div
      layout
      className="p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors relative z-10"
    >
      <motion.div layout className="font-mono text-sm mb-3">
        {label}
      </motion.div>
      <motion.div layout className="pl-3 border-l-2 border-primary/20">
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Swaps</span>
            <motion.span
              ref={totalSwapsNumberRef}
              animate={{
                scale:
                  value > previousValueRef.current.value ? [1, 1.06, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {value.toLocaleString()}
            </motion.span>
          </div>
          <div className="h-3 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              style={{ width: `${hookedSwapsPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-primary">{`${hookedSwapsPercent.toFixed(1)}% hooked`}</span>
            <motion.span
              ref={hookedSwapsNumberRef}
              animate={{
                scale:
                  (hookedSwaps || 0) > previousValueRef.current.hookedSwaps
                    ? [1, 1.06, 1]
                    : 1,
                color:
                  (hookedSwaps || 0) > previousValueRef.current.hookedSwaps
                    ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                    : "inherit",
              }}
              transition={{ duration: 0.3 }}
            >
              {(hookedSwaps || 0).toLocaleString()}
            </motion.span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pools</span>
            <motion.span
              ref={totalPoolsNumberRef}
              animate={{
                scale:
                  pools > previousValueRef.current.value ? [1, 1.06, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {pools.toLocaleString()}
            </motion.span>
          </div>
          <div className="h-3 bg-secondary rounded-md overflow-hidden">
            <motion.div
              className="h-full bg-primary relative"
              style={{ width: `${hookedPoolsPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-primary">{`${hookedPoolsPercent.toFixed(1)}% hooked`}</span>
            <motion.span
              ref={hookedPoolsNumberRef}
              animate={{
                scale:
                  (hookedPools || 0) > previousValueRef.current.hookedPools
                    ? [1, 1.06, 1]
                    : 1,
                color:
                  (hookedPools || 0) > previousValueRef.current.hookedPools
                    ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                    : "inherit",
              }}
              transition={{ duration: 0.3 }}
            >
              {(hookedPools || 0).toLocaleString()}
            </motion.span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
