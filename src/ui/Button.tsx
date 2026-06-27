import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'px-5 py-2.5 text-[11px]',
  md: 'px-8 py-4 text-[13px]',
  lg: 'px-10 py-5 text-[15px]',
}

const VARIANT = {
  primary: 'bg-persimmon text-white border-2 border-persimmon hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#1A2336]',
  ghost: 'bg-transparent text-navy border-2 border-navy hover:bg-navy hover:text-white hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#E96630]',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center font-display font-bold uppercase tracking-[0.2em] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
