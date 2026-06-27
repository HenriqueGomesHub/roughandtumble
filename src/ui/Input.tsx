import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const fieldId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={fieldId} className="font-display text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-navy">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        className={`border-[3px] ${error ? 'border-persimmon' : 'border-navy'} bg-white text-navy px-5 py-4 font-body text-base placeholder:text-navy/30 focus:outline-none focus:border-persimmon focus:shadow-[4px_4px_0_0_#E96630] transition-all ${className}`}
        {...rest}
      />
      {error && (
        <p role="alert" className="font-display font-bold text-[10px] uppercase tracking-widest text-persimmon mt-1">
          {error}
        </p>
      )}
    </div>
  )
})
