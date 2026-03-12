import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PageWrapper({ title, subtitle, children }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0E0B1F]">
      <Sidebar />
      <div className="ml-[230px] min-h-screen">
        <Topbar title={title} subtitle={subtitle} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
