import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

const useDialogContext = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
};

const DialogOverlay = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const { onOpenChange } = useDialogContext();
  return (
    <div
      className={cn("fixed inset-0 z-40 bg-black/50", className)}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  );
};
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext();

    if (!open || typeof document === "undefined") return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogOverlay />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative z-50 w-full max-w-lg rounded-lg bg-background p-6 shadow-lg outline-none", 
            className
          )}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {children}
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>
      </div>,
      document.body
    );
  }
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-4 space-y-1 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { onOpenChange } = useDialogContext();
  return (
    <button type="button" {...props} onClick={(event) => { event.preventDefault(); onOpenChange(true); }}>
      {children}
    </button>
  );
};
DialogTrigger.displayName = "DialogTrigger";

export {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger
};
