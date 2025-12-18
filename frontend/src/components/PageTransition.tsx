import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevLocation = useRef(location);

  useEffect(() => {
    if (location !== prevLocation.current) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setIsTransitioning(false);
        prevLocation.current = location;
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [location, children]);

  return (
    <div
      className={`transition-opacity duration-150 ease-out ${
        isTransitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {displayChildren}
    </div>
  );
}
