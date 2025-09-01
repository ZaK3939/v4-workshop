import { useState, useEffect, useRef } from "react";
import { AlertCircle, ChevronDown, ExternalLink, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HooksModal } from "./HooksModal";

interface HookInfo {
  id: string;
  fields: Record<string, any>;
}

interface HookInformationProps {
  highlightedHookAddress?: string | null;
}

export function HookInformation({
  highlightedHookAddress,
}: HookInformationProps) {
  const [hookInfo, setHookInfo] = useState<HookInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHook, setSelectedHook] = useState<{
    address: string;
    chainId: string;
    name: string;
  } | null>(null);
  const highlightedCardRef = useRef<HTMLDivElement>(null);
  const [isHighlightActive, setIsHighlightActive] = useState(false);

  // Function to extract chain ID from the address format (chainId_address)
  const extractChainId = (addressWithChain: string | undefined): string => {
    if (!addressWithChain) return "130"; // Default to Unichain if address is undefined
    if (addressWithChain.includes("_")) {
      const parts = addressWithChain.split("_");
      return parts[0] || "130";
    }
    return "130"; // Default to Unichain if no chain ID is specified
  };

  // Function to extract address from the format (chainId_address)
  const extractAddress = (addressWithChain: string | undefined): string => {
    if (!addressWithChain) return ""; // Return empty string if address is undefined
    if (addressWithChain.includes("_")) {
      const parts = addressWithChain.split("_");
      return parts[1] || addressWithChain;
    }
    return addressWithChain;
  };

  useEffect(() => {
    const fetchHookInfo = async () => {
      try {
        const response = await fetch("/api/hooks/info");
        if (!response.ok) throw new Error("Failed to fetch hook information");
        const data = await response.json();
        setHookInfo(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch hook information"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchHookInfo();
  }, []);

  // Effect to scroll to highlighted hook when it changes
  useEffect(() => {
    if (highlightedHookAddress && !isLoading && hookInfo.length > 0) {
      // Find the hook with the matching address
      const hookToHighlight = hookInfo.find((h) => {
        const addressField = h.fields?.address || h.fields?.Address || "";
        return addressField === highlightedHookAddress;
      });

      if (hookToHighlight) {
        // If the hook is found, make sure its type is selected
        if (
          hookToHighlight.fields?.Type &&
          selectedType !== "All" &&
          !hookToHighlight.fields.Type.includes(selectedType)
        ) {
          setSelectedType("All");
        }

        // Activate highlight
        setIsHighlightActive(true);

        // Set a timeout to allow the UI to update before scrolling
        setTimeout(() => {
          if (highlightedCardRef.current) {
            highlightedCardRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 100);

        // Set a timeout to fade out the highlight after 3 seconds
        const timer = setTimeout(() => {
          setIsHighlightActive(false);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightedHookAddress, isLoading, hookInfo, selectedType]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const types = [
    "All",
    ...new Set(
      hookInfo
        .filter((h) => h.fields && h.fields.Type)
        .map((h) => h.fields.Type.split(", "))
        .flat()
    ),
  ].sort();

  const filteredHooks = hookInfo.filter((h) => {
    const matchesType =
      selectedType === "All" ||
      (h.fields && h.fields.Type && h.fields.Type.includes(selectedType));
    const matchesSearch =
      searchTerm === "" ||
      (h.fields &&
        h.fields.Name &&
        h.fields.Name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (h.fields &&
        h.fields["Project Description"] &&
        h.fields["Project Description"]
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Sort hooks to prioritize those with addresses
  const sortedHooks = [...filteredHooks].sort((a, b) => {
    const aAddressStr = a.fields?.address || "";
    const bAddressStr = b.fields?.address || "";

    const aHasAddress =
      typeof aAddressStr === "string" &&
      aAddressStr.includes("_") &&
      aAddressStr.includes("0x");
    const bHasAddress =
      typeof bAddressStr === "string" &&
      bAddressStr.includes("_") &&
      bAddressStr.includes("0x");

    // Hooks with addresses come first
    if (aHasAddress && !bHasAddress) return -1;
    if (!aHasAddress && bHasAddress) return 1;

    // If both have addresses or both don't have addresses, sort alphabetically by name
    return (a.fields?.Name || "").localeCompare(b.fields?.Name || "");
  });

  const displayedEntries = showAllEntries
    ? sortedHooks
    : sortedHooks.slice(0, 6);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-secondary/30 rounded-lg">
        <AlertCircle className="w-4 h-4" />
        <span>
          Displaying hook information courtesy of{" "}
          <a
            href="https://twitter.com/SilvioBusonero"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary transition-colors"
          >
            @SilvioBusonero
          </a>
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex justify-center">
          <div className="flex flex-wrap justify-center gap-1.5">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                  ${
                    selectedType === type
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-foreground"
                  }
                  border border-border/50
                `}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search hooks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/40 bg-background/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[400px] relative p-1">
        <AnimatePresence mode="popLayout">
          {displayedEntries.map((entry) => {
            // Log the address to debug
            console.log(
              `Hook ${entry.fields?.Name}: Address = ${entry.fields?.address}`
            );

            // Check if address exists and has the correct format (chainId_0x...)
            const addressStr = entry.fields?.address || "";
            const hasAddress =
              typeof addressStr === "string" &&
              addressStr.includes("_") &&
              addressStr.includes("0x");

            // Check if this is the highlighted hook
            const isHighlighted =
              isHighlightActive &&
              highlightedHookAddress &&
              (entry.fields?.address === highlightedHookAddress ||
                entry.fields?.Address === highlightedHookAddress);

            // Log whether this hook is considered clickable
            if (entry.fields?.address) {
              console.log(
                `Hook ${entry.fields?.Name}: Clickable = ${hasAddress}, Address format = ${addressStr}`
              );
            }

            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: isHighlighted ? 1.02 : 1,
                  boxShadow: isHighlighted
                    ? "0 0 0 2px rgba(var(--primary), 0.5)"
                    : "none",
                  transition: {
                    duration: 0.3,
                    boxShadow: { duration: isHighlighted ? 0.3 : 1.5 },
                  },
                }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                transition={{
                  duration: 0.3,
                  layout: { duration: 0.3 },
                }}
                className={`
                  group flex flex-col p-4 rounded-lg border border-border/50 
                  bg-secondary/5 hover:bg-secondary/10 transition-all duration-200 h-full
                  ${hasAddress ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}
                  ${isHighlighted ? "border-primary/50 shadow-md" : ""}
                  relative z-10 overflow-hidden transform-gpu
                `}
                ref={isHighlighted ? highlightedCardRef : null}
                onClick={() => {
                  console.log(
                    `Hook clicked: ${entry.fields?.Name}, Has address: ${hasAddress}`
                  );
                  if (hasAddress) {
                    const addressWithChain = entry.fields.address;
                    const extractedAddress = extractAddress(addressWithChain);
                    const extractedChainId = extractChainId(addressWithChain);

                    console.log(
                      `Opening modal with: Address = ${extractedAddress}, ChainId = ${extractedChainId}`
                    );

                    setSelectedHook({
                      address: extractedAddress,
                      chainId: extractedChainId,
                      name: entry.fields?.Name || "Unnamed Hook",
                    });
                  }
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {entry.fields?.Name || "Unnamed Hook"}
                  </h3>
                  <span
                    className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${getStageStyles(entry.fields?.["Stage "] || "")}
                    `}
                  >
                    {entry.fields?.["Stage "] || "Unknown"}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {entry.fields?.["Project Description"] ||
                    "No description available"}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {entry.fields?.Type &&
                    entry.fields.Type.split(", ").map((type: string) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 bg-secondary/10 rounded-full text-xs font-medium border border-border/20"
                      >
                        {type}
                      </span>
                    ))}
                </div>

                <div className="mt-auto pt-3 border-t border-border/30">
                  <div className="flex flex-wrap gap-3">
                    {entry.fields?.website && (
                      <a
                        href={entry.fields.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()} // Prevent triggering the card click
                      >
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </a>
                    )}
                    {entry.fields?.X && (
                      <a
                        href={entry.fields.X}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()} // Prevent triggering the card click
                      >
                        <ExternalLink className="w-3 h-3" />X (Twitter)
                      </a>
                    )}
                    {entry.fields?.address && (
                      <a
                        href={`https://scope.sh/${extractChainId(entry.fields.address)}/address/${extractAddress(entry.fields.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()} // Prevent triggering the card click
                      >
                        <ExternalLink className="w-3 h-3" />
                        Contract
                      </a>
                    )}
                  </div>

                  {hasAddress && (
                    <button
                      className="w-full mt-3 py-1.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent the card click event
                        const addressWithChain = entry.fields.address;
                        const extractedAddress =
                          extractAddress(addressWithChain);
                        const extractedChainId =
                          extractChainId(addressWithChain);

                        console.log(
                          `Button clicked: Opening modal with: Address = ${extractedAddress}, ChainId = ${extractedChainId}`
                        );

                        setSelectedHook({
                          address: extractedAddress,
                          chainId: extractedChainId,
                          name: entry.fields?.Name || "Unnamed Hook",
                        });
                      }}
                    >
                      View Pools Using This Hook
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredHooks.length > 6 && (
        <motion.button
          onClick={() => setShowAllEntries(!showAllEntries)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-all duration-200 group border border-border/50"
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
        >
          <span className="text-sm font-medium">
            {showAllEntries
              ? "Show Less"
              : `Show All Projects (${filteredHooks.length})`}
          </span>
          <motion.div
            animate={{ rotate: showAllEntries ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        </motion.button>
      )}

      <AnimatePresence>
        {selectedHook && (
          <HooksModal
            hook={selectedHook}
            onClose={() => setSelectedHook(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getStageStyles(stage: string): string {
  if (!stage) {
    return "bg-secondary/20 text-muted-foreground border-border/50";
  }

  const baseStyles = "border transition-colors duration-200";
  if (stage.includes("Mainnet")) {
    return `${baseStyles} bg-green-500/10 text-green-500 border-green-500/20`;
  }
  if (stage.includes("Testnet")) {
    return `${baseStyles} bg-blue-500/10 text-blue-500 border-blue-500/20`;
  }
  if (stage.includes("R&D")) {
    return `${baseStyles} bg-yellow-500/10 text-yellow-500 border-yellow-500/20`;
  }
  return `${baseStyles} bg-secondary/20 text-muted-foreground border-border/50`;
}
