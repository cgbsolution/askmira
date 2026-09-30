"use client";

import React, { useState } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/**
 * One page of an in-memory list. The page clamps itself when the list
 * shrinks (a filter, a delete), so it never shows an empty page 4 of 2.
 */
export function usePaged<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const offset = (current - 1) * pageSize;
  return {
    rows: rows.slice(offset, offset + pageSize),
    offset,
    page: current,
    pages,
    total: rows.length,
    pageSize,
    setPage,
  };
}

/** Page numbers to show: the ends, and two either side of the current one. */
function pageList(current: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, current - 1, current, current + 1]);
  const list: (number | "gap")[] = [];
  for (let number = 1; number <= pages; number += 1) {
    if (wanted.has(number)) list.push(number);
    else if (list[list.length - 1] !== "gap") list.push("gap");
  }
  return list;
}

/** "Showing 1 to 10 of 42 entries" and the page links, for a DataPanel footer. */
export function TablePager({
  paged,
  noun = "entries",
}: {
  paged: Pick<ReturnType<typeof usePaged>, "offset" | "page" | "pages" | "total" | "pageSize" | "setPage">;
  noun?: string;
}) {
  const { offset, page, pages, total, pageSize, setPage } = paged;
  const go = (number: number) => (event: React.MouseEvent) => {
    event.preventDefault();
    setPage(Math.min(pages, Math.max(1, number)));
  };
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {total === 0 ? 0 : offset + 1} to {Math.min(offset + pageSize, total)} of {total} {noun}
      </p>
      {pages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" aria-disabled={page === 1} onClick={go(page - 1)} />
            </PaginationItem>
            {pageList(page, pages).map((number, index) =>
              number === "gap" ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={number}>
                  <PaginationLink href="#" isActive={number === page} onClick={go(number)}>
                    {number}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext href="#" aria-disabled={page === pages} onClick={go(page + 1)} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
