"use client";

import dynamic from "next/dynamic";

// Import the demo component
const VynlPlatform = dynamic(() => import("@/app/components/VynlPlatformDemo"), {
  ssr: false,
});

export default function VynlPlatformDemoPage() {
  return <VynlPlatform />;
}
