"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { ReactNode } from "react";

interface MobileCardField {
  label: string;
  value: ReactNode;
}

interface MobileCardProps {
  title: string;
  subtitle?: string;
  fields: MobileCardField[];
  actions?: ReactNode;
  className?: string;
}

/**
 * MobileCard - Card-based layout for mobile devices
 * Replaces table rows with cards on small screens
 */
export function MobileCard({ title, subtitle, fields, actions, className }: MobileCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {fields.map((field, index) => (
            <div key={index} className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">
                {field.label}
              </div>
              <div className="text-foreground">{field.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
      {actions && (
        <CardFooter className="pt-3 border-t flex gap-2">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
}
