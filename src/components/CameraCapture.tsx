import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

/** Live camera view; each shot is handed back as a JPEG File. */
export function CameraCapture({ onShot, onClose }: { onShot: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let dead = false
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      .then((s) => {
        if (dead) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setError('Camera access was blocked or no camera was found. You can choose photos instead.'))
    return () => {
      dead = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function shoot() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob(
      (b) => {
        if (!b) return
        const n = ++countRef.current
        setCount(n)
        onShot(new File([b], `scan-${n}.jpg`, { type: 'image/jpeg' }))
        setFlash(true)
        setTimeout(() => setFlash(false), 150)
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm">{count ? `${count} page${count === 1 ? '' : 's'} captured` : 'Fill the frame with the page'}</span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
          Done
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {error ? (
          <p className="max-w-sm px-6 text-center text-sm text-white/80">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full" />
        )}
        {flash && <div className="absolute inset-0 bg-white/70" />}
      </div>
      <div className="flex items-center justify-center p-5">
        {error ? (
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-3 text-white" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={shoot}
            aria-label="Capture page"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white active:scale-95"
          >
            <Camera className="h-7 w-7" />
          </button>
        )}
      </div>
    </div>
  )
}
