export const AUTH_TABS = Object.freeze(['/dashboard','/discover','/social','/inbox','/profile']);
export const PUBLIC_TABS = Object.freeze(['/','/discover','/globe','/community','/help']);
const PREFIXES = Object.freeze({
  '/discover':['/discover','/campaign','/create','/globe'],
  '/inbox':['/inbox','/communications','/notifications'],
  '/profile':['/profile','/devices','/giving','/following','/subscriptions','/withdrawals','/ledger'],
  '/social':['/social'],
  '/dashboard':['/dashboard'],
  '/community':['/community'],
  '/help':['/help'],
});
export function owningNavigationTab(pathname,isAuthenticated=false) {
  if(pathname==='/')return isAuthenticated?'/dashboard':'/';
  const tabs=isAuthenticated?AUTH_TABS:PUBLIC_TABS;
  for(const tab of tabs){
    if(tab==='/globe'&&pathname==='/globe')return '/globe';
    const prefixes=PREFIXES[tab]||[tab];
    if(prefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/')))return tab;
  }
  return null;
}
export function navigationBackFallback(pathname,isAuthenticated=false){
  return owningNavigationTab(pathname,isAuthenticated)||(isAuthenticated?'/dashboard':'/');
}
export function canReturnWithinApp(historyState){
  return Number.isInteger(historyState?.idx)&&historyState.idx>0;
}
