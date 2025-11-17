"use client";

import type { UserData } from "@/app/components/types_portal";
import dynamic from "next/dynamic";


const CompletePortalUI = dynamic(() => import("../components/complete_portal_ui"), { ssr: false });


interface CompletePortalUIClientProps {
  user: UserData;
}

export default function CompletePortalUIClient({ user }: CompletePortalUIClientProps) {
  return <CompletePortalUI user={user} />;
}
