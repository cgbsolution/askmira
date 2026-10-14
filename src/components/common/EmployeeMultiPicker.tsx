"use client";

import { X } from "lucide-react";
import React from "react";

import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmployeeSummary } from "@/lib/types";

/**
 * Pick several employees, one search at a time. The chosen people show as
 * removable chips above the search.
 */
export function EmployeeMultiPicker({
  id,
  value,
  onChange,
  excludeId = null,
  invalid = false,
  disabled = false,
}: {
  id: string;
  value: EmployeeSummary[];
  onChange: (employees: EmployeeSummary[]) => void;
  excludeId?: string | null;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const add = (employee: EmployeeSummary | null) => {
    if (!employee || value.some((chosen) => chosen.id === employee.id)) return;
    onChange([...value, employee]);
  };

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((employee) => (
            <Badge key={employee.id} variant="secondary" className="gap-1 pr-1">
              {employeeDisplayName(employee)}
              <span className="text-muted-foreground">{employee.employee_code}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                disabled={disabled}
                aria-label={`Remove ${employeeDisplayName(employee)}`}
                onClick={() => onChange(value.filter((chosen) => chosen.id !== employee.id))}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
      <EmployeePicker
        id={id}
        value={null}
        onChange={add}
        excludeId={excludeId}
        invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
}
