import DashboardLayoutUI from './layout-ui'

// Sin verificación server-side — el cliente maneja el auth (evita loops de redirect)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutUI>{children}</DashboardLayoutUI>
}
