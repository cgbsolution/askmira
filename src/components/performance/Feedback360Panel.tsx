"use client";

import { Users } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Feedback360 } from "@/lib/types/performance";

const RELATION: Record<string, string> = {
  manager: "Manager",
  skip_level: "Manager's manager",
  direct_report: "Direct reports",
  peer: "Peers",
  other: "Others",
};

/**
 * The cycle's 360 feedback, beside the review it informs. Shown as the
 * feedback page would show it to this viewer: the manager line and HR read
 * names; the person reads what their request allows. A relationship group is
 * averaged only when it has enough answers to keep each one anonymous.
 */
export function Feedback360Panel({ requests }: { requests: Feedback360[] }) {
  if (requests.length === 0) return null;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" /> 360 feedback this cycle
        </CardTitle>
        <CardDescription>What colleagues said, to weigh beside the ratings — not a score in itself.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {requests.map((request) => (
          <div key={request.request_id} className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {request.answered} of {request.asked} colleagues answered
              {request.status !== "open" ? "" : " so far"}.
            </p>
            {request.by_relationship.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {request.by_relationship.map((group) => (
                  <Badge key={group.relationship} variant={group.withheld ? "muted" : "secondary"}>
                    {RELATION[group.relationship] ?? group.relationship}:{" "}
                    {group.withheld ? `${group.responses} answer(s), too few to show` : `${group.overall_average} average`}
                  </Badge>
                ))}
              </div>
            )}
            {request.aggregate && request.aggregate.competencies.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competency</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Answers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.aggregate.competencies.map((row) => (
                    <TableRow key={row.competency_id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.average ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.responses}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {request.aggregate && (request.aggregate.strengths.length > 0 || request.aggregate.improvements.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Strengths</p>
                  <ul className="grid gap-1 text-sm">
                    {request.aggregate.strengths.map((text, index) => (
                      <li key={index}>“{text}”</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">To work on</p>
                  <ul className="grid gap-1 text-sm">
                    {request.aggregate.improvements.map((text, index) => (
                      <li key={index}>“{text}”</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {request.responses_named && request.responses_named.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Each answer, with its writer</summary>
                <ul className="mt-2 grid gap-2">
                  {request.responses_named.map((answer, index) => (
                    <li key={index} className="rounded-md border p-3">
                      <p className="font-medium">
                        {answer.reviewer_name}
                        {answer.relationship ? ` · ${RELATION[answer.relationship] ?? answer.relationship}` : ""}
                        {answer.overall_rating ? ` · ${answer.overall_rating}` : ""}
                      </p>
                      {answer.strengths && <p className="mt-1">Strengths: {answer.strengths}</p>}
                      {answer.improvements && <p className="mt-1">To work on: {answer.improvements}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
