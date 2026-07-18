import { useEffect } from 'react'

export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title
    let el = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!el) {
      el = document.createElement('meta')
      el.name = 'description'
      document.head.appendChild(el)
    }
    el.content = description
  }, [title, description])
}
