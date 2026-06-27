const PALETTE = ['bg-navy', 'bg-persimmon', 'bg-navy-deep', 'bg-persimmon-deep'] as const

function colorClass(initials: string): string {
  let h = 0
  for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) % PALETTE.length
  return PALETTE[h]
}

const SIZE = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
}

interface Props {
  initials: string
  size?: keyof typeof SIZE
  className?: string
}

export function Avatar({ initials, size = 'md', className = '' }: Props) {
  return (
    <div
      aria-label={initials}
      className={`inline-flex items-center justify-center font-display font-bold text-white uppercase select-none ${colorClass(initials)} ${SIZE[size]} ${className}`}
    >
      {initials.slice(0, 2)}
    </div>
  )
}
