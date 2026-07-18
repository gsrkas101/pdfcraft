import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HubPage from './pages/HubPage'
import PrivacyPage from './pages/PrivacyPage'
import NotFound from './pages/NotFound'
import MergeTool from './tools/MergeTool'
import SplitTool from './tools/SplitTool'
import OrganizeTool from './tools/OrganizeTool'
import RotateTool from './tools/RotateTool'
import CompressTool from './tools/CompressTool'
import JpgToPdfTool from './tools/JpgToPdfTool'
import PdfToJpgTool from './tools/PdfToJpgTool'
import WatermarkTool from './tools/WatermarkTool'
import PageNumbersTool from './tools/PageNumbersTool'

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
