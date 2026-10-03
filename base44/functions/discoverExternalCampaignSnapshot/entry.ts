import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';

const HOSTS:any={gofundme:['gofundme.com'],kickstarter:['kickstarter.com'],indiegogo:['indiegogo.com'],fundrazr:['fundrazr.com'],givesendgo:['givesendgo.com'],kofi:['ko-fi.com'],buymeacoffee:['buymeacoffee.com'],patreon:['patreon.com'],spotfund:['spotfund.com'],eventbrite:['eventbrite.com']};
const hostAllowed=(platform:string,host:string)=>(HOSTS[platform]||[]).some((d:string)=>host===d||host.endsWith('.'+d));
const decode=(s='')=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const readMeta=(html:string,key:string)=>{
  const tags=html.match(/<meta\s+[^>]*>/gi)||[];
  for(const tag of tags){
    const property=tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]||'';
    if(property.toLowerCase()!==key.toLowerCase()) continue;
    const value=tag.match(/content=["']([^"']*)["']/i)?.[1]||'';
    if(value) return decode(value.trim());
  }
  return '';
};
const readTitle=(html:string)=>readMeta(html,'og:title')||decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()||'');

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    if(!hasUnifiedOboConsent(user)) return Response.json({error:'AI/OBO authorization is required to import from a connected fundraiser.'},{status:403});
    const body=await req.json().catch(()=>({}));
    const connection=await base44.entities.PlatformConnection.get(body.connection_id).catch(()=>null);
    if(!connection||connection.created_by_id!==user.id||connection.kind!=='crowdfunding') return Response.json({error:'Connected fundraiser not found.'},{status:404});
    const platform=String(connection.platform||'').toLowerCase();
    const url=new URL(String(connection.external_url||''));
    if(url.protocol!=='https:'||!hostAllowed(platform,url.hostname.toLowerCase())) return Response.json({error:'This provider URL is not eligible for automatic campaign discovery.'},{status:400});
    const response=await fetch(url.toString(),{redirect:'follow',headers:{'user-agent':'InterplanetaryFund-CampaignImport/1.0'}});
    if(!response.ok) return Response.json({error:'The provider campaign page could not be read.'},{status:502});
    const finalUrl=new URL(response.url);
    if(finalUrl.protocol!=='https:'||!hostAllowed(platform,finalUrl.hostname.toLowerCase())) return Response.json({error:'Provider redirected outside its approved campaign domain.'},{status:502});
    const html=(await response.text()).slice(0,2000000);
    const description=readMeta(html,'og:description')||readMeta(html,'description');
    const campaign={title:readTitle(html).slice(0,200),summary:description.slice(0,1000),story:description.slice(0,30000),cover_image_url:readMeta(html,'og:image').slice(0,2000),category:'other'};
    return Response.json({ok:true,campaign,source_url:finalUrl.toString(),source:'provider_public_campaign_page'});
  }catch(error){
    console.error('discoverExternalCampaignSnapshot failed:',error?.message||error);
    return Response.json({error:'The external campaign could not be discovered safely.'},{status:500});
  }
}