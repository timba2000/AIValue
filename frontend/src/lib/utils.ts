import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function prefixSearch(searchQuery: string, text: string): boolean {
  const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (searchWords.length === 0) return true;
  
  const textWords = text.toLowerCase().match(/\b\w+\b/g) || [];
  return searchWords.every(searchWord => 
    textWords.some(textWord => textWord.startsWith(searchWord))
  );
}
