import { Menu, X } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileNav({ isOpen, onToggle }: MobileNavProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b bg-gray-100 px-4 py-3 shadow-sm md:hidden">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-gray-700 shadow-sm hover:bg-gray-200"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="sr-only">Toggle navigation</span>
      </button>
      <span className="text-sm font-semibold text-gray-800">Menu</span>
    </div>
  );
}
