import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BRASA · Hecho al fuego, listo para llevar', description: 'Hamburguesas, papas y buenos momentos. Demo de pedidos con retiro en local.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es-CL"><body>{children}</body></html>; }
