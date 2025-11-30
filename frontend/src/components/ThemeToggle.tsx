import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore } from "../stores/themeStore";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const themes = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex items-center justify-center p-2 rounded-lg transition-all duration-200
            ${theme === value 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
            }
          `}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleCompact() {
  const { resolvedTheme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-accent transition-all duration-300 group"
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      <Sun className={`h-5 w-5 absolute transition-all duration-300 ${
        resolvedTheme === "dark" 
          ? "opacity-0 rotate-90 scale-0" 
          : "opacity-100 rotate-0 scale-100 text-amber-500"
      }`} />
      <Moon className={`h-5 w-5 absolute transition-all duration-300 ${
        resolvedTheme === "dark" 
          ? "opacity-100 rotate-0 scale-100 text-purple-400" 
          : "opacity-0 -rotate-90 scale-0"
      }`} />
    </button>
  );
}
