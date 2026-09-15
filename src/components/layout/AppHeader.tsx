"use client";

import { Bell, Menu, Moon, PanelLeft, PanelLeftClose, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";

/**
 * Top bar: people search, theme, notifications.
 *
 * Search goes to the directory with the term applied — the one search the
 * product can answer truthfully today. The bell links to the inbox; the unread
 * count is shown by the notifications work, not guessed here.
 */
export function AppHeader() {
  const { isExpanded, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [term, setTerm] = useState("");

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleMobileSidebar}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label={isExpanded ? "Collapse navigation" : "Pin navigation open"}
      >
        {isExpanded ? <PanelLeftClose /> : <PanelLeft />}
      </Button>

      <form
        role="search"
        className="relative hidden max-w-md flex-1 sm:block"
        onSubmit={(event) => {
          event.preventDefault();
          const query = term.trim();
          router.push(query ? `/people?search=${encodeURIComponent(query)}` : "/people");
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={term}
          maxLength={100}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search people by name, code or email"
          className="pl-9"
          aria-label="Search people"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>

        <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
          <Link href="/notifications">
            <Bell />
          </Link>
        </Button>
      </div>
    </header>
  );
}
