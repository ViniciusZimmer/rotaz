import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rotaz — Validação',
}

export default function ValidacaoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
