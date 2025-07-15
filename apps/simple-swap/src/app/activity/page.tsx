import { Header } from "@/components/layout/header";
import { ActivityPage } from '@/components/activity/ActivityPage';

export default function Activity() {
  return (
    <div className="relative flex flex-col min-h-screen">
      <Header />
      <ActivityPage />
    </div>
  );
}