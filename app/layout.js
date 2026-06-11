import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'AgroFin — Premium Personal Finance & Farm OS',
  description: 'A wealth & farm operating system built for the software-engineer-farmer hybrid.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
