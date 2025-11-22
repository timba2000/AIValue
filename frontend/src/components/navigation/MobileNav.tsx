import { Menu, X } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileNav({ isOpen, onToggle }: MobileNavProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm backdrop-blur-sm md:hidden">
      <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        AIValue
      </h1>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        <span className="sr-only">Toggle navigation</span>
      </button>
    </div>
  );
}
