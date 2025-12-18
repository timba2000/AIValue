import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ content, children, className, maxWidth = "max-w-xs" }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const tooltipRef = React.useRef<HTMLDivElement>(null);

    const showTooltip = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
        setIsVisible(true);
      }
    };

    const hideTooltip = () => {
      setIsVisible(false);
    };

    return (
      <div
        ref={triggerRef}
        className={cn("relative inline-block", className)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
        {isVisible && content && (
          <div
            ref={tooltipRef}
            className={cn(
              "fixed z-[9999] px-3 py-2 text-sm rounded-lg shadow-lg",
              "bg-popover text-popover-foreground border border-border",
              "transform -translate-x-1/2 -translate-y-full",
              "animate-in fade-in-0 zoom-in-95 duration-100",
              maxWidth
            )}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <div className="whitespace-pre-wrap break-words">{content}</div>
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-px"
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid hsl(var(--border))",
              }}
            />
          </div>
        )}
      </div>
    );
  }
);
Tooltip.displayName = "Tooltip";

interface TruncatedTextProps {
  text: string;
  className?: string;
  maxWidth?: string;
}

const TruncatedText = ({ text, className, maxWidth = "max-w-sm" }: TruncatedTextProps) => {
  return (
    <Tooltip content={text} maxWidth={maxWidth}>
      <span className={cn("block truncate", className)}>{text}</span>
    </Tooltip>
  );
};

export { Tooltip, TruncatedText };
