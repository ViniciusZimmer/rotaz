import { NavBar } from '@/components/NavBar'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavBar />
      <div className="pt-14">{children}</div>
    </>
  )
}
