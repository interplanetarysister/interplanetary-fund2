import { useEffect } from "react";
import TermsAcceptance from "@/components/TermsAcceptance";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from './pages/Home'; import Login from './pages/Login'; import Register from './pages/Register'; import ForgotPassword from './pages/ForgotPassword'; import ResetPassword from './pages/ResetPassword'; import Layout from './components/Layout'; import Dashboard from './pages/Dashboard'; import Discover from './pages/Discover'; import CreateCampaign from './pages/CreateCampaign'; import CampaignDetail from './pages/CampaignDetail'; import MyGiving from './pages/MyGiving'; import Communications from './pages/Communications'; import MissionControlPage from './pages/MissionControlPage'; import Community from './pages/Community'; import CommunityDetail from './pages/CommunityDetail'; import Institutions from './pages/Institutions'; import InstitutionDetail from './pages/InstitutionDetail'; import Analytics from './pages/Analytics'; import Platform from './pages/Platform'; import Onboarding from './pages/Onboarding'; import Profile from './pages/Profile'; import Connections from './pages/Connections'; import Inbox from './pages/Inbox'; import FollowedCampaigns from './pages/FollowedCampaigns'; import Notifications from './pages/Notifications'; import Subscriptions from './pages/Subscriptions'; import Withdrawals from './pages/Withdrawals'; import GlobalGlobe from './pages/GlobalGlobe'; import EmbedCampaign from './pages/EmbedCampaign'; import Agents from './pages/Agents'; import OpsCenter from './pages/OpsCenter'; import FacebookGroups from './pages/FacebookGroups'; import OAuthConsent from './pages/OAuthConsent'; import Connect from './pages/Connect'; import ExternalAccounts from './pages/ExternalAccounts'; import IntegrationsAdmin from './pages/IntegrationsAdmin'; import Help from './pages/Help'; import About from './pages/About'; import Contact from './pages/Contact';
import BrandLogo from "@/components/brand/BrandLogo";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) return <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;
  if (authError) { if (authError.type === 'user_not_registered') return <UserNotRegisteredError />; if (authError.type === 'auth_required') { navigateToLogin(); return null; } }
  return <Routes>
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/globe" element={<GlobalGlobe />} /><Route path="/embed/campaign/:id" element={<EmbedCampaign />} /><Route path="/oauth/consent" element={<OAuthConsent />} /><Route path="/" element={<Home />} /><Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} />
    <Route element={<Layout />}><Route path="/discover" element={<Discover />} /><Route path="/campaign/:id" element={<CampaignDetail />} /><Route path="/community" element={<Community />} /><Route path="/community/:id" element={<CommunityDetail />} /><Route path="/help" element={<Help />} /></Route>
    <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}><Route path="/onboarding" element={<Onboarding />} /><Route element={<Layout />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/create" element={<CreateCampaign />} /><Route path="/giving" element={<MyGiving />} /><Route path="/communications" element={<Communications />} /><Route path="/mission" element={<MissionControlPage />} /><Route path="/institutions" element={<Institutions />} /><Route path="/institutions/:id" element={<InstitutionDetail />} /><Route path="/profile" element={<Profile />} /><Route path="/connections" element={<Connections />} /><Route path="/inbox" element={<Inbox />} /><Route path="/following" element={<FollowedCampaigns />} /><Route path="/notifications" element={<Notifications />} /><Route path="/subscriptions" element={<Subscriptions />} /><Route path="/withdrawals" element={<Withdrawals />} /><Route path="/agents" element={<Agents />} /><Route path="/ops" element={<OpsCenter />} /><Route path="/analytics" element={<Analytics />} /><Route path="/platform" element={<Platform />} /><Route path="/facebook" element={<FacebookGroups />} /><Route path="/connect" element={<Connect />} /><Route path="/admin/external-accounts" element={<ExternalAccounts />} /><Route path="/admin/integrations" element={<IntegrationsAdmin />} /></Route></Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>;
};

function App() {
  useEffect(() => { const mq = window.matchMedia("(prefers-color-scheme: dark)"); const apply = (e) => document.documentElement.classList.toggle("dark", e.matches); apply(mq); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }, []);
  return <AuthProvider><QueryClientProvider client={queryClientInstance}><Router><ScrollToTop /><TermsAcceptance><AuthenticatedApp /></TermsAcceptance></Router><Toaster /></QueryClientProvider></AuthProvider>;
}
export default App;