import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({
  label,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors ${
          error ? 'border-red-400' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
