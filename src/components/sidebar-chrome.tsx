"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type SidebarChromeValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarChromeContext = createContext<SidebarChromeValue | null>(null);

const STORAGE_KEY = "fleetos_sidebar_collapsed";

let collapsedStore = false;
const collapsedListeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onStoreChange: () => void): () => void {
  collapsedListeners.add(onStoreChange);
  return () => collapsedListeners.delete(onStoreChange);
}

function getCollapsedSnapshot(): boolean {
  return collapsedStore;
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

function writeCollapsed(value: boolean) {
  collapsedStore = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  for (const listener of collapsedListeners) listener();
}

// Seed from localStorage on first client access
if (typeof window !== "undefined") {
  collapsedStore = readCollapsed();
}

let mobileOpenStore = false;
const mobileListeners = new Set<() => void>();

function subscribeMobile(onStoreChange: () => void): () => void {
  mobileListeners.add(onStoreChange);
  return () => mobileListeners.delete(onStoreChange);
}

function getMobileSnapshot(): boolean {
  return mobileOpenStore;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

function writeMobileOpen(value: boolean) {
  mobileOpenStore = value;
  for (const listener of mobileListeners) listener();
}

export function SidebarChromeProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const mobileOpen = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );

  const setCollapsed = useCallback((value: boolean) => {
    writeCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    writeCollapsed(!getCollapsedSnapshot());
  }, []);

  const openMobile = useCallback(() => writeMobileOpen(true), []);
  const closeMobile = useCallback(() => writeMobileOpen(false), []);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      openMobile,
      closeMobile,
    }),
    [
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      openMobile,
      closeMobile,
    ],
  );

  return (
    <SidebarChromeContext.Provider value={value}>
      {children}
    </SidebarChromeContext.Provider>
  );
}

export function useSidebarChrome(): SidebarChromeValue {
  const ctx = useContext(SidebarChromeContext);
  if (!ctx) {
    throw new Error(
      "useSidebarChrome must be used within SidebarChromeProvider",
    );
  }
  return ctx;
}
