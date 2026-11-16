import type { NextConfig } from 'next';
const development = process.env.NODE_ENV === 'development';
const localProxy = development && process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PROXY === 'true';
const config: NextConfig = {
 distDir:development ? '.next' : '.next-production',
 images: { unoptimized: true },
 ...(!development ? {output:'export' as const} : {}),
 ...(localProxy ? {
  allowedDevOrigins:['127.0.0.1',...(process.env.BRASA_LAN_HOSTS||'').split(',').map(host=>host.trim()).filter(Boolean)],
  async rewrites(){return ['auth/v1','rest/v1','storage/v1','functions/v1'].map(service=>({source:`/supabase/${service}/:path*`,destination:`http://127.0.0.1:54321/${service}/:path*`}));}
 } : {})
};
export default config;
