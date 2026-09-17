"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

type Option = { id: string; name: string };

/** Department / location / keyword filter for the public job list; state lives in the URL. */
export function CareersJobFilters({
  slug,
  departments,
  locations,
  initial,
}: {
  slug: string;
  departments: Option[];
  locations: Option[];
  initial: { department_id: string; location_id: string; search: string };
}) {
  const router = useRouter();
  const [department, setDepartment] = useState(initial.department_id || ALL);
  const [location, setLocation] = useState(initial.location_id || ALL);
  const [search, setSearch] = useState(initial.search);

  const base = `/careers/${encodeURIComponent(slug)}`;

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (department !== ALL) params.set("department_id", department);
    if (location !== ALL) params.set("location_id", location);
    const term = search.trim();
    if (term) params.set("search", term.slice(0, 100));
    const qs = params.toString();
    router.push(qs ? `${base}?${qs}` : base);
  }

  function clear() {
    setDepartment(ALL);
    setLocation(ALL);
    setSearch("");
    router.push(base);
  }

  const filtered = department !== ALL || location !== ALL || search.trim() !== "";

  return (
    <form
      onSubmit={apply}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end"
      role="search"
    >
      <FormField htmlFor="careers-department" label="Department">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger id="careers-department" className="w-full">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor="careers-location" label="Location">
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger id="careers-location" className="w-full">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            {locations.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor="careers-search" label="Search">
        <Input
          id="careers-search"
          type="search"
          value={search}
          maxLength={100}
          placeholder="Role or keyword"
          onChange={(event) => setSearch(event.target.value)}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit">
          <Search /> Apply
        </Button>
        {filtered && (
          <Button type="button" variant="ghost" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
