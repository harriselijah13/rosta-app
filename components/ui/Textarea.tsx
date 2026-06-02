import { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export default function Textarea({
  label,
  error,
  id,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors resize-none ${
          error ? 'border-red-400' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
