import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface RouterContextValue {
  location: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function Router({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setLocation(window.location.pathname);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback(
    (to: string) => {
      if (to !== location) {
        window.history.pushState(null, "", to);
        setLocation(window.location.pathname);
      }
    },
    [location]
  );

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useLocation(): [string, (to: string) => void] {
  const context = useContext(RouterContext);

  const navigate = context
    ? context.navigate
    : (to: string) => {
        window.history.pushState(null, "", to);
        window.dispatchEvent(new PopStateEvent("popstate"));
      };

  const location = context ? context.location : window.location.pathname;

  return [location, navigate];
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function Link({ href, onClick, ...rest }: LinkProps) {
  const [, navigate] = useLocation();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigate(href);
  };

  return <a href={href} onClick={handleClick} {...rest} />;
}

function matchPath(path: string | undefined, location: string) {
  if (!path) return true;
  return path === location;
}

export interface RouteProps {
  path?: string;
  component?: React.ComponentType<any>;
  children?: React.ReactNode | ((params: Record<string, string>) => React.ReactNode);
}

export function Route({ path, component: Component, children }: RouteProps) {
  const [location] = useLocation();

  if (!matchPath(path, location)) return null;

  if (Component) return <Component />;

  if (typeof children === "function") {
    return <>{children({})}</>;
  }

  return <>{children}</>;
}

export function Switch({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  let match: React.ReactElement | null = null;

  React.Children.forEach(children, (child) => {
    if (match) return;
    if (!React.isValidElement(child)) return;

    const childPath = (child.props as RouteProps).path;
    if (matchPath(childPath, location)) {
      match = child as React.ReactElement;
    }
  });

  return match;
}
