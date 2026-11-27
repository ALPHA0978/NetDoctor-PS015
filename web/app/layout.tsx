import type { Metadata } from 'next';
import './globals.css';
import '../../chrome-focus/dropdown.css';
export const metadata:Metadata={ title:'NetDoctor | Connection diagnostics',description:'Understand where a home connection is struggling and what to do next. A PS-015 diagnostic workspace.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}

