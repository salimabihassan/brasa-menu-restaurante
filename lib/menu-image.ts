export function menuImage(image:string,width=600){
 if(image.startsWith('menu:')){
  const path=image.slice(5).split('/').map(encodeURIComponent).join('/');
  const base=process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PROXY==='true'?'/supabase':process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/brasa-menu/${path}`;
 }
 return /^photo-[a-zA-Z0-9-]+$/.test(image)?`https://images.unsplash.com/${image}?auto=format&fit=crop&w=${width}&q=85`:'/images/product-placeholder.svg';
}
