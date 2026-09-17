"use client";

import { useParams } from "next/navigation";
import React from "react";

import { SelfScheduleView } from "@/components/careers/SelfScheduleView";

/** Candidate self-scheduling, reached through the link the recruiter sent. */
export default function SelfSchedulePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  return <SelfScheduleView token={token} />;
}
