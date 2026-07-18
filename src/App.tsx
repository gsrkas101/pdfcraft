import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HubPage from './pages/HubPage'
import PrivacyPage from './pages/PrivacyPage'
import NotFound from './pages/NotFound'

// Tool pages are code-split so the first visit only downloads the hub;
// pdf-lib and friends arrive on demand when a tool is opened.
const MergeTool = lazy(() => import('./tools/MergeTool'))
const SplitTool = lazy(() => import('./tools/SplitTool'))
const OrganizeTool = lazy(() => import('./tools/OrganizeTool'))
const RotateTool = lazy(() => import('./tools/RotateTool'))
const CompressTool = lazy(() => import('./tools/CompressTool'))
const JpgToPdfTool = lazy(() => import('./tools/JpgToPdfTool'))
const PdfToJpgTool = lazy(() => import('./tools/PdfToJpgTool'))
const WatermarkTool = lazy(() => import('./tools/WatermarkTool'))
const PageNumbersTool = lazy(() => import('./tools/PageNumbersTool'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HubPage />} />
        <Route path="merge-pdf" element={<MergeTool />} />
        <Route path="split-pdf" element={<SplitTool mode="split" />} />
        <Route path="extract-pages" element={<SplitTool mode="extract" />} />
        <Route path="remove-pages" element={<SplitTool mode="remove" />} />
        <Route path="organize-pdf" element={<OrganizeTool />} />
        <Route path="rotate-pdf" element={<RotateTool />} />
        <Route path="compress-pdf" element={<CompressTool />} />
        <Route path="jpg-to-pdf" element={<JpgToPdfTool />} />
        <Route path="pdf-to-jpg" element={<PdfToJpgTool />} />
        <Route path="add-watermark" element={<WatermarkTool />} />
        <Route path="add-page-numbers" element={<PageNumbersTool />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
