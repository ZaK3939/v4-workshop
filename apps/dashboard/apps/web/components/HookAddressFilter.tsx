import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface HookAddressFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function HookAddressFilter({ 
  value, 
  onChange, 
  placeholder = "Filter by hook address (e.g. 0x0050E651...)" 
}: HookAddressFilterProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300); // Debounce for 300ms

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-64 pl-10 pr-10 py-1.5 text-sm bg-secondary/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 rounded hover:bg-secondary/50 transition-colors"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}