import { Menu, X } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileNav({ isOpen, onToggle }: MobileNavProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-6 py-4 shadow-sm md:hidden">
      <h1 className="text-lg font-bold gradient-text">
        AIValue
      </h1>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center justify-center rounded-xl p-2 text-foreground transition-colors hover:bg-accent active:bg-accent/80"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        <span className="sr-only">Toggle navigation</span>
      </button>
    </div>
  );
}
