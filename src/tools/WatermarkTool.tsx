import { useEffect, useRef, useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { AddFilesButton, FileDrop } from '../components/FileDrop'
import { Field, PositionGrid, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import {
  addImageWatermark,
  addTextWatermark,
  type PlacedPosition,
} from '../lib/pdf/watermark'
import { parsePageRanges } from '../lib/pdf/split'
import { fileToEmbeddable } from '../lib/browser/canvas'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

const PLACED: PlacedPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const COLORS = {
  gray: { r: 0.5, g: 0.53, b: 0.58 },
  red: { r: 0.86, g: 0.15, b: 0.15 },
  blue: { r: 0.15, g: 0.39, b: 0.92 },
  green: { r: 0.02, g: 0.59, b: 0.41 },
} as const

type ColorKey = keyof typeof COLORS

const INPUT = 'rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

export default function WatermarkTool() {
  const tool = getTool('watermark')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [tab, setTab] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [fontSize, setFontSize] = useState(48)
  const [colorKey, setColorKey] = useState<ColorKey>('gray')
  const [opacity, setOpacity] = useState(30)
  const [rotation, setRotation] = useState<'0' | '45'>('45')
  const [tiled, setTiled] = useState(false)
  const [position, setPosition] = useState<PlacedPosition>('center')
  const [rangeSpec, setRangeSpec] = useState('')

  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const imgUrlRef = useRef(imgUrl)
  imgUrlRef.current = imgUrl
  useEffect(
    () => () => {
      if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current)
    },
    [],
  )
  const [imgScale, setImgScale] = useState(40)
  const [imgOpacity, setImgOpacity] = useState(50)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const pageIndices = rangeSpec.trim() ? parsePageRanges(rangeSpec, pageCount).flat() : undefined
      let data: Uint8Array
      if (tab === 'text') {
        data = await addTextWatermark(bytes, {
          text,
          fontSize,
          color: COLORS[colorKey],
          opacity: opacity / 100,
          rotation: Number(rotation),
          position: tiled ? 'tiled' : position,
          pageIndices,
        })
      } else {
        if (!imgFile) return
        const emb = await fileToEmbeddable(imgFile)
        data = await addImageWatermark(bytes, {
          imageBytes: emb.bytes,
          imageKind: emb.kind,
          scale: imgScale / 100,
          opacity: imgOpacity / 100,
          position,
          pageIndices,
        })
      }
      setResult({ name: outputName(file.name, 'watermarked'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a PDF" />
      ) : loading ? (
        <p className="animate-pulse text-sm text-slate-500">Reading PDF…</p>
      ) : loadError ? (
        <div>
          <ErrorAlert message={loadError} />
          <button className="btn-secondary mt-4" onClick={reset}>
            Try another file
          </button>
        </div>
      ) : doc ? (
        <div className="space-y-5">
          <Segmented
            options={[
              { value: 'text', label: 'Text watermark' },
              { value: 'image', label: 'Image watermark' },
            ]}
            value={tab}
            onChange={setTab}
          />

          <div className="card grid gap-6 sm:grid-cols-2">
            {tab === 'text' ? (
              <>
                <Field label="Text">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={`${INPUT} w-full`}
                    data-testid="watermark-text"
                  />
                </Field>
                <Field label={`Size: ${fontSize} pt`}>
                  <input
                    type="range"
                    min={24}
                    max={96}
                    step={4}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </Field>
                <Field label="Color">
                  <Segmented
                    options={[
                      { value: 'gray', label: 'Gray' },
                      { value: 'red', label: 'Red' },
                      { value: 'blue', label: 'Blue' },
                      { value: 'green', label: 'Green' },
                    ]}
                    value={colorKey}
                    onChange={setColorKey}
                  />
                </Field>
                <Field label={`Opacity: ${opacity}%`}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </Field>
                {!tiled && (
                  <Field label="Rotation">
                    <Segmented
                      options={[
                        { value: '0', label: 'Straight' },
                        { value: '45', label: 'Diagonal (45°)' },
                      ]}
                      value={rotation}
                      onChange={setRotation}
                    />
                  </Field>
                )}
                <Field label="Position">
                  <div className="flex items-center gap-4">
                    {!tiled && <PositionGrid positions={PLACED} value={position} onChange={setPosition} />}
                    <button
                      type="button"
                      onClick={() => setTiled((t) => !t)}
                      className={`btn-secondary ${tiled ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : ''}`}
                    >
                      {tiled ? '✓ Tiled across page' : 'Tile across page'}
                    </button>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label="Watermark image">
                  <div className="flex items-center gap-4">
                    {imgUrl && (
                      <img src={imgUrl} alt="watermark" className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain" />
                    )}
                    <AddFilesButton
                      kind="image"
                      label={imgFile ? 'Change image' : 'Choose image'}
                      onFiles={(f) => {
                        if (imgUrl) URL.revokeObjectURL(imgUrl)
                        setImgFile(f[0])
                        setImgUrl(URL.createObjectURL(f[0]))
                      }}
                    />
                  </div>
                </Field>
                <Field label={`Width: ${imgScale}% of page`}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={imgScale}
                    onChange={(e) => setImgScale(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </Field>
                <Field label={`Opacity: ${imgOpacity}%`}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={imgOpacity}
                    onChange={(e) => setImgOpacity(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </Field>
                <Field label="Position">
                  <PositionGrid positions={PLACED} value={position} onChange={setPosition} />
                </Field>
              </>
            )}
            <Field label={`Pages (optional — this PDF has ${pageCount})`}>
              <input
                value={rangeSpec}
                onChange={(e) => setRangeSpec(e.target.value)}
                placeholder="all pages — or e.g. 1-3, 5"
                className={`${INPUT} w-full max-w-xs`}
              />
            </Field>
          </div>

          <button
            className="btn-primary"
            disabled={busy || (tab === 'text' ? !text.trim() : !imgFile)}
            onClick={run}
            data-testid="action-button"
          >
            Add watermark
          </button>
          {busy && <p className="animate-pulse text-sm text-slate-500">Applying watermark…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
