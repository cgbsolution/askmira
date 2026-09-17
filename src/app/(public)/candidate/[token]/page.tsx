"use client";

import { useParams } from "next/navigation";
import React from "react";

import { CandidatePortalView } from "@/components/careers/CandidatePortalView";

/** Candidate portal, reached through the one-time link issued after applying. */
export default function CandidatePortalPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  return <CandidatePortalView token={token} />;
}
