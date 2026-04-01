import * as React from "react";
import { Button } from "../components/ui/button";

type ThemedButtonProps = {
  children: React.ReactNode;
  backgroundColor: string;
  textColor: string;
  hoverColor?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  disabled?: boolean;
  asChild?: boolean;
  onClick?: () => void;
};

function hexToRgb(hex: string, fallback = { r: 15, g: 28, b: 46 }) {
  const clean = String(hex || "").replace("#", "").trim();

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  return fallback;
}

function darkenHex(hex: string, amount = 0.1) {
  const { r, g, b } = hexToRgb(hex);
  const darken = (c: number) => Math.max(0, Math.floor(c * (1 - amount)));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
}

export function ThemedButton({
  children,
  backgroundColor,
  textColor,
  hoverColor,
  className = "",
  variant = "outline",
  disabled,
  asChild,
  onClick,
}: ThemedButtonProps) {
  const finalHover = hoverColor ?? darkenHex(backgroundColor, 0.8);

  return (
    <Button
      asChild={asChild}
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className={`border-none transition-colors duration-200 ${className}`}
      style={{
        backgroundColor,
        color: textColor,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = finalHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = backgroundColor;
      }}
    >
      {children}
    </Button>
  );
}