import { DashboardShell } from "./layout/DashboardShell";

export function Shell({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
