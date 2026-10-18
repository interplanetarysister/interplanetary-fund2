import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkRateLimit } from '../../shared/rateLimit.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reply = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export default async function(req) {
  if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(()=>({}));
    // Honeypot discourages indiscriminate form bots without blocking real people.
    if (body.website) return reply({ok:true,message:'Thanks for your interest.'});
    const email = String(body.email || '').trim().toLowerCase();
    const screen_name = String(body.screen_name || '').trim();
    const interest = String(body.interest || 'both');
    const marketing_opt_in = body.marketing_opt_in === true;
    const referred_by = String(body.ref || '').trim();
    if (!EMAIL.test(email) || email.length > 254 || screen_name.length > 50 ||
      !['support','fundraise','both'].includes(interest) ||
      (referred_by && !/^[a-f0-9-]{10,60}$/i.test(referred_by))) {
      return reply({error:'Please enter a valid email and selection.'},400);
    }
    if (body.consent !== true) return reply({error:'Please agree to the waitlist privacy notice.'},400);
    const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'anonymous').split(',')[0].trim();
    const limiter = await checkRateLimit(base44, 'foundingWaitlist:' + ip, 5, 3600);
    if (!limiter.allowed) return reply({error:'Too many attempts. Please try again later.'},429);
    const existing = await base44.asServiceRole.entities.FoundingWaitlist.filter({email});
    if (existing?.length) return reply({ok:true,message:'You are on the list already.',referral_code:existing[0].referral_code});
    const referral_code = crypto.randomUUID();
    await base44.asServiceRole.entities.FoundingWaitlist.create({
      email,screen_name,interest,marketing_opt_in,referral_code,
      referred_by:referred_by || '',status:'waiting',joined_at:new Date().toISOString()
    });
    return reply({ok:true,message:'You are on the founding-member list.',referral_code});
  } catch(e) {
    console.error('joinFoundingWaitlist failure',e?.name || 'UnknownError');
    return reply({error:'We could not save your signup. Please try again.'},503);
  }
}
