interface Props {
  points: number
  className?: string
}

export function ScorePill({ points, className = '' }: Props) {
  return (
    <div className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className="font-display font-bold text-2xl leading-none text-persimmon">
        {points.toLocaleString()}
      </span>
      <span className="font-body text-xs uppercase tracking-wide text-muted-navy">pts</span>
    </div>
  )
}
