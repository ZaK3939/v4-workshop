"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export const LogoHeader = () => {
  return (
    <div className="flex flex-col items-center mb-4 sm:mb-6 relative z-10">
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        {/* Logo with glow */}
        <div className="relative z-10">
          {/* Multiple glow layers */}
          <motion.div
            className="absolute inset-[-2px] rounded-2xl blur-md"
            animate={{
              background: [
                "linear-gradient(45deg, #4299e1, #0ea5e9, #4299e1)",
                "linear-gradient(45deg, #0ea5e9, #4299e1, #0ea5e9)",
                "linear-gradient(45deg, #4299e1, #0ea5e9, #4299e1)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
          <motion.div
            className="absolute inset-[-2px] rounded-2xl blur-md opacity-75"
            animate={{
              background: [
                "linear-gradient(190deg, #4299e180, #0ea5e980)",
                "linear-gradient(190deg, #0ea5e980, #4299e180)",
                "linear-gradient(190deg, #4299e180, #0ea5e980)",
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse",
              delay: 0.5,
            }}
          />
          <motion.div
            className="absolute inset-[-2px] rounded-2xl blur-md opacity-50"
            animate={{
              background: [
                "linear-gradient(320deg, #4299e180, #0ea5e980)",
                "linear-gradient(320deg, #0ea5e980, #4299e180)",
                "linear-gradient(320deg, #4299e180, #0ea5e980)",
              ],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              repeatType: "reverse",
              delay: 1,
            }}
          />

          {/* Main content box */}
          <motion.div
            className="relative px-5 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-white dark:bg-white/95 shadow-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 relative z-10">
              v4
            </h1>
          </motion.div>
        </div>

        {/* Text content */}
        <div className="flex flex-col items-center sm:items-start mt-2 sm:mt-0">
          <motion.div
            className="text-gray-600 text-sm md:text-base font-medium text-center sm:text-left"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            The hub for Uniswap v4 data on Unichain
          </motion.div>
          <motion.div
            className="flex items-center gap-1.5 text-xs text-muted-foreground/80 flex-wrap justify-center sm:justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <span>Powered by</span>
            <a
              href="https://docs.envio.dev/docs/HyperIndex/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary transition-colors font-medium"
            >
              HyperIndex
            </a>
            <span>on</span>
            <a
              href="https://envio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center hover:opacity-80 transition-opacity"
            >
              <Image
                src="https://d30nibem0g3f7u.cloudfront.net/Envio-Logo.png"
                alt="Envio"
                width={96}
                height={40}
                className="h-3.5 w-auto object-contain"
                quality={100}
                priority
              />
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
