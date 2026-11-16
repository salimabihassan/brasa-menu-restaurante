import {BrasaApp} from '@/components/brasa-app';
import type {Metadata} from 'next';
export const metadata:Metadata={manifest:'/staff.webmanifest',appleWebApp:{capable:true,title:'BRASA Local',statusBarStyle:'default'}};
export default function Page(){return <BrasaApp area='local'/>;}
