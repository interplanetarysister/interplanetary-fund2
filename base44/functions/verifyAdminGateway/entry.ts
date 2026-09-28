import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    if(user.role!=='admin') return Response.json({error:'Forbidden'},{status:403});
    return Response.json({id:user.id,role:'admin'});
  } catch(error) {
    console.error('verifyAdminGateway error',error?.message||error);
    return Response.json({error:'Unable to verify administrator.'},{status:500});
  }
}
