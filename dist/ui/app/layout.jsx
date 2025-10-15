import { Inter } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from './providers';
const inter = Inter({ subsets: ['latin'] });
export const metadata = {
    title: 'Orbit Pipeline',
    description: 'Resilient job execution pipeline with retry logic',
};
export default function RootLayout({ children, }) {
    return (<html lang="en">
      <body className={inter.className}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>);
}
//# sourceMappingURL=layout.jsx.map