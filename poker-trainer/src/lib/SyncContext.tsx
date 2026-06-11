/**
 * Provides scheduleSync globally so any page can trigger a cloud save
 * without prop-drilling.
 */
import { createContext, useContext, type ReactNode } from 'react';

type SyncCtx = { scheduleSync: () => void };
const SyncContext = createContext<SyncCtx>({ scheduleSync: () => {} });

export function SyncProvider({ scheduleSync, children }: SyncCtx & { children: ReactNode }) {
  return <SyncContext.Provider value={{ scheduleSync }}>{children}</SyncContext.Provider>;
}

export const useSyncContext = () => useContext(SyncContext);
