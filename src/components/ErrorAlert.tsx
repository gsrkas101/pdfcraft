import { CircleAlert } from 'lucide-react'

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
