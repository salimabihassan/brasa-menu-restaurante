import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BRASA · Hecho al fuego, listo para llevar', description: 'Hamburguesas, papas y buenos momentos. Demo de pedidos con retiro en local.', manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'BRASA',statusBarStyle:'default'},icons:{apple:'/icons/brasa-192.png'} };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es-CL" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('brasa-theme')==='dark'?'dark':'light'}catch{}"}}/></head><body>{children}</body></html>; }
