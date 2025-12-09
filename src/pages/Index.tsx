
import React from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { AiAssistantSection } from '@/components/landing/AiAssistantSection';
import { FinancialsSection } from '@/components/landing/FinancialsSection';
import { ExpandableGallery } from '@/components/landing/ExpandableGallery';
import { WorkflowSteps } from '@/components/landing/WorkflowSteps';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Header } from '@/components/shared/Header';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const Index = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white dark selection:bg-indigo-500/30">
      <Header />
      <HeroSection />
      <ExpandableGallery />
      <FeaturesSection />
      <WorkflowSteps />
      <AiAssistantSection />
      <FinancialsSection />
      <LandingFooter />
    </div>
  );
};

export default Index;
