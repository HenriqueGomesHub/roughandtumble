import type { ReactNode } from 'react'

interface Props {
  variant?: 'paper' | 'navy' | 'white'
  className?: string
  children: ReactNode
}

const VARIANT = {
  paper: 'bg-paper text-navy border-2 border-navy shadow-[4px_4px_0_0_#232F49]',
  navy: 'bg-navy text-white border-2 border-navy shadow-[4px_4px_0_0_#E96630]',
  white: 'bg-white text-navy border-2 border-navy shadow-[4px_4px_0_0_#232F49]',
}

export function Card({ variant = 'paper', className = '', children }: Props) {
  return (
    <div className={`p-6 md:p-8 ${VARIANT[variant]} ${className}`}>
      {children}
    </div>
  )
}
