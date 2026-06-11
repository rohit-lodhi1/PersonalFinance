'use client'
import dynamic from 'next/dynamic'

const AgroFinApp = dynamic(() => import('@/components/agrofin/AgroFinApp'), { ssr: false })

const App = () => <AgroFinApp />
export default App
