import { motion, useSpring, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface TvlAnimatedBarProps {
  label: string;
  tvl: number;
  maxTvl: number;
  volume: number;
  maxVolume: number;
}

export function TvlAnimatedBar({
  label,
  tvl,
  maxTvl,
  volume,
  maxVolume,
}: TvlAnimatedBarProps) {
  const tvlRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef({
    tvl,
    volume,
  });

  const tvlWidth = (tvl / maxTvl) * 100;
  const volumeWidth = (volume / maxVolume) * 100;

  // More responsive spring animation for the bar
  const springValue = useSpring(0, {
    stiffness: 80, // Increased stiffness for more "snappy" movement
    damping: 12, // Reduced damping for more "bounce"
    mass: 0.3, // Reduced mass for quicker response
  });
  const barWidth = useTransform(springValue, [0, 100], ["0%", "100%"]);

  useEffect(() => {
    springValue.set(tvlWidth);
  }, [tvlWidth, springValue]);

  // Format currency values
  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  useEffect(() => {
    const tvlNode = tvlRef.current;
    if (!tvlNode) return;

    const tvlControls = animate(previousValueRef.current.tvl, tvl, {
      duration: 1.2, // Slightly longer duration
      ease: [0.32, 0.72, 0, 1], // Custom easing for more "punch"
      onUpdate(value) {
        tvlNode.textContent = formatCurrency(value);
      },
    });

    const volumeNode = volumeRef.current;
    if (!volumeNode) return;

    const volumeControls = animate(previousValueRef.current.volume, volume, {
      duration: 1.2,
      ease: [0.32, 0.72, 0, 1],
      onUpdate(value) {
        volumeNode.textContent = formatCurrency(value);
      },
    });

    previousValueRef.current.tvl = tvl;
    previousValueRef.current.volume = volume;

    return () => {
      tvlControls.stop();
      volumeControls.stop();
    };
  }, [tvl, volume]);

  return (
    <motion.div
      layout
      className="flex items-center gap-4 w-full group relative z-10"
    >
      <div className="w-24 text-sm font-mono">{label}</div>
      <div className="flex-1 space-y-2">
        {/* Primary TVL bar */}
        <div className="h-4 bg-secondary rounded-md overflow-hidden">
          <motion.div
            className="h-full bg-primary relative"
            style={{ width: `${tvlWidth}%` }}
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
        {/* Secondary Volume bar */}
        <div className="h-1 bg-secondary rounded-md overflow-hidden">
          <motion.div
            className="h-full bg-primary relative"
            style={{ width: `${volumeWidth}%` }}
          />
        </div>
      </div>
      <div className="w-32 text-right space-y-1">
        <div className="flex justify-end items-center gap-1">
          <motion.div
            ref={tvlRef}
            className="font-mono tabular-nums"
            animate={{
              scale: tvl > previousValueRef.current.tvl ? [1, 1.06, 1] : 1,
              color:
                tvl > previousValueRef.current.tvl
                  ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                  : "inherit",
            }}
            transition={{ duration: 0.3 }}
          >
            {formatCurrency(tvl)}
          </motion.div>
          <span className="text-xs text-muted-foreground">TVL</span>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          <motion.span
            ref={volumeRef}
            animate={{
              color:
                volume > previousValueRef.current.volume
                  ? ["inherit", "hsl(142.1 76.2% 36.3%)", "inherit"]
                  : "inherit",
            }}
            transition={{ duration: 0.3 }}
          >
            {formatCurrency(volume)}
          </motion.span>{" "}
          volume
        </div>
      </div>
    </motion.div>
  );
}
