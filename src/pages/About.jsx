import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

export default function About() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden deep-space">
        <div className="relative px-5 sm:px-8 py-16 sm:py-24 max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></div>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] text-white mb-6">
            About <span className="brand-gradient-text">Interplanetary Fund</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            The Universal Fundraising Operating System — built to connect every cause, every platform, and every supporter in one place.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20 space-y-8">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">What we do</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund is an AI-powered fundraising platform that lets organizers and nonprofits create a campaign once and distribute it across every major crowdfunding and social platform. Instead of juggling a dozen disconnected tools, creators get a single dashboard to build their campaign story, accept donations through multiple payment methods, publish updates across social networks, communicate with supporters, and track performance — all in one place. Our AI agents act as an intelligent assistant layer: they recommend outreach opportunities, draft campaign content, and surface the next best action, but they never execute without human approval. The platform also provides a canonical financial ledger, cross-platform fund syncing, withdrawal management with a 7-day clearing period for institutional donations, and a live community feed so supporters can follow campaigns in real time.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">Who it is for</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund is designed for anyone who needs to raise money for a cause, a project, or a dream. That includes individuals fundraising for medical expenses, emergencies, memorials, or creative projects; small businesses seeking capital; nonprofits that want to operate more efficiently; communities organizing around local needs; and institutions looking for a sophisticated fundraising operating system without assembling dozens of disconnected products. We built it so that a family raising money for an important need can spend less time fighting technology and more time reaching people, and so that an organizer with a great idea and no marketing department can access capabilities that previously required a whole team. Our long-term vision extends to organizations, communities, institutions, and eventually businesses participating in a connected funding network.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">Who builds it</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund is built by Michelle Rogers and a team dedicated to making fundraising more connected, transparent, and trustworthy. The platform is engineered with scalability in mind — its ambition is global, and its technology is being built to serve campaigns at every scale. We believe fundraising is fundamentally about trust: when someone contributes their money, they are putting trust in the person asking for help. That is why every decision we make — from our AI-assistive design philosophy to our canonical financial ledger and our platform access registry — is grounded in transparency, accountability, and keeping humans in control. We are actively looking for partners who see the potential to build a larger ecosystem around how people fund ideas, causes, projects, and possibilities. Every successful campaign begins with a question: <span className="brand-gradient-text font-semibold">What if?</span> Interplanetary Fund exists to help turn that question into momentum.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link to="/discover"><Button variant="outline" className="rounded-xl"><Compass className="w-4 h-4 mr-2" /> Explore causes</Button></Link>
          <Link to="/create"><Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90"><Sparkles className="w-4 h-4 mr-2" /> Start a campaign <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
      </section>
    </div>
  );
}