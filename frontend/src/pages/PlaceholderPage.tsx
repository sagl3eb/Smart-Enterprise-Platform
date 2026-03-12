import PageWrapper from "../components/layout/PageWrapper";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  module: string;
}

export default function PlaceholderPage({ title, module }: PlaceholderPageProps) {
  return (
    <PageWrapper title={title} subtitle={`${module} module`}>
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center mb-4">
          <Construction size={28} className="text-[#5B21B6]" />
        </div>
        <h2 className="text-xl font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] mb-2">
          {title}
        </h2>
        <p className="text-sm text-[#9B93B8] dark:text-[#6B5F8F]">
          This page will be built in upcoming sessions
        </p>
      </div>
    </PageWrapper>
  );
}
