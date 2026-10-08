import { lazy, Suspense, useEffect, useRef } from "react";
import TermsAcceptance from "@/components/TermsAcceptance";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
const Layout = lazy(() => import('./components/Layout'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Discover = lazy(() => import('./pages/Discover'));
const CreateCampaign = lazy(() => import('./pages/CreateCampaign'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const MyGiving = lazy(() => import('./pages/MyGiving'));
const Communications = lazy(() => import('./pages/Communications'));
const MissionControlPage = lazy(() => import('./pages/MissionControlPage'));
const Community = lazy(() => import('./pages/Community'));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'));
const Institutions = lazy(() => import('./pages/Institutions'));
const InstitutionDetail = lazy(() => import('./pages/InstitutionDetail'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Platform = lazy(() => import('./pages/Platform'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Profile = lazy(() => import('./pages/Profile'));
const Connections = lazy(() => import('./pages/Connections'));
const Inbox = lazy(() => import('./pages/Inbox'));
const FollowedCampaigns = lazy(() => import('./pages/FollowedCampaigns'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Donors = lazy(() => import('./pages/Donors'));
const FinancialLedger = lazy(() => import('./pages/FinancialLedger'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Withdrawals = lazy(() => import('./pages/Withdrawals'));
const GlobalGlobe = lazy(() => import('./pages/GlobalGlobe'));
const EmbedCampaign = lazy(() => import('./pages/EmbedCampaign'));
const Agents = lazy(() => import('./pages/Agents'));
const OpsCenter = lazy(() => import('./pages/OpsCenter'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const DeviceActivation = lazy(() => import('./pages/DeviceActivation'));
const ConnectedDevices = lazy(() => import('./pages/ConnectedDevices'));
const Connect = lazy(() => import('./pages/Connect'));
const ExternalAccounts = lazy(() => import('./pages/ExternalAccounts'));
const IntegrationsAdmin = lazy(() => import('./pages/IntegrationsAdmin'));
const AuditLogAdmin = lazy(() => import('./pages/AuditLogAdmin'));
const Help = lazy(() => import('./pages/Help'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Social = lazy(() => import('./pages/Social'));
import BrandLogo from "@/components/brand/BrandLogo";
import ErrorBoundary from "@/components/ErrorBoundary";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const checkedReturn = useRef(false);
  useEffect(() => {
    if (isLoadingAuth || isLoadingPublicSettings || authError || checkedReturn.current) return;
    checkedReturn.current = true;
    // A popup callback may land directly on /connections. Only the main tab
    // stays here; a popup informs its opener and closes after provider return.
    if (pathname === "/connections" && !window.opener) return;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem("ifund_pending_platform_connection") || "null"); } catch { /* Invalid resume data is ignored. */ }
    if (!pending || Date.now() - pending.startedAt >= 20 * 60 * 1000) return;
    // In a script-opened OAuth window, tell its same-origin opener to resume
    // and close the small window. OAuth state and tokens stay with the provider.
    if (window.opener && pending.step === "oauth_pending") {
      try {
        window.opener.postMessage({
          type: "ifund-provider-oauth-returned", platform: pending.platform,
        }, window.location.origin);
        window.close();
        return;
      } catch { /* If opener is severed, resume through the regular page. */ }
    }
    import("@/api/base44Client").then(({ base44 }) => base44.auth.me())
      .then((me) => { if (me?.id === pending.userId) navigate("/connections", { replace: true }); })
      .catch(() => {});
  }, [isLoadingAuth, isLoadingPublicSettings, authError, pathname, navigate]);
  if (isLoadingPublicSettings || isLoadingAuth) return <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;
  if (authError) { if (authError.type === 'user_not_registered') return <UserNotRegisteredError />; if (authError.type === 'auth_required') { navigateToLogin(); return null; } }
  return <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>}><Routes>
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/globe" element={<GlobalGlobe />} /><Route path="/embed/campaign/:id" element={<EmbedCampaign />} /><Route path="/oauth/consent" element={<OAuthConsent />} /><Route path="/activate" element={<DeviceActivation />} /><Route path="/" element={<Home />} /><Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} />
    <Route element={<Layout />}><Route path="/discover" element={<Discover />} /><Route path="/campaign/:id" element={<CampaignDetail />} /><Route path="/community" element={<Community />} /><Route path="/community/:id" element={<CommunityDetail />} /><Route path="/help" element={<Help />} /></Route>
    <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}><Route path="/onboarding" element={<Onboarding />} /><Route element={<Layout />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/create" element={<CreateCampaign />} /><Route path="/giving" element={<MyGiving />} /><Route path="/communications" element={<Communications />} /><Route path="/social" element={<Social />} /><Route path="/mission" element={<MissionControlPage />} /><Route path="/institutions" element={<Institutions />} /><Route path="/institutions/:id" element={<InstitutionDetail />} /><Route path="/profile" element={<Profile />} /><Route path="/devices" element={<ConnectedDevices />} /><Route path="/connections" element={<Connections />} /><Route path="/inbox" element={<Inbox />} /><Route path="/following" element={<FollowedCampaigns />} /><Route path="/notifications" element={<Notifications />} /><Route path="/donors" element={<Donors />} /><Route path="/ledger" element={<FinancialLedger />} /><Route path="/subscriptions" element={<Subscriptions />} /><Route path="/withdrawals" element={<Withdrawals />} /><Route path="/agents" element={<Agents />} /><Route element={<AdminRoute />}><Route path="/ops" element={<OpsCenter />} /><Route path="/platform" element={<Platform />} /><Route path="/analytics" element={<Analytics />} /><Route path="/connect" element={<Connect />} /><Route path="/admin/external-accounts" element={<ExternalAccounts />} /><Route path="/admin/integrations" element={<IntegrationsAdmin />} /><Route path="/admin/audit" element={<AuditLogAdmin />} /></Route></Route></Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes></Suspense>;
};

function App() {
  useEffect(() => { const mq = window.matchMedia("(prefers-color-scheme: dark)"); const apply = (e) => document.documentElement.classList.toggle("dark", e.matches); apply(mq); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }, []);
  return <ErrorBoundary><AuthProvider><QueryClientProvider client={queryClientInstance}><Router><ScrollToTop /><TermsAcceptance><AuthenticatedApp /></TermsAcceptance><Toaster /></Router></QueryClientProvider></AuthProvider></ErrorBoundary>;
}
export default App;