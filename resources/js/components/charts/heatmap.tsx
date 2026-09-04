"use client";

import { useMemo } from "react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

interface HeatmapDataPoint {
  day: string;
  hour: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  config: ChartConfig;
  title?: string;
  description?: string;
  dayLabels?: string[];
  hourLabels?: string[];
  className?: string;
  height?: number;
  minValue?: number;
  maxValue?: number;
}

const DEFAULT_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const COLOR_STOPS = [
  { stop: 0, color: "var(--chart-1)" },
  { stop: 0.25, color: "var(--chart-2)" },
  { stop: 0.5, color: "var(--chart-3)" },
  { stop: 0.75, color: "var(--chart-4)" },
  { stop: 1, color: "var(--chart-5)" },
];

function getColorForValue(value: number, min: number, max: number): string {
  if (max === min) return "var(--chart-1)";
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = ratio * (COLOR_STOPS.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return COLOR_STOPS[lower].color;

  const lowerColor = COLOR_STOPS[lower].color;
  const upperColor = COLOR_STOPS[upper].color;
  const t = index - lower;

  return interpolateColor(lowerColor, upperColor, t);
}

function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1.replace("var(--", "").replace(")", ""));
  const c2 = hexToRgb(color2.replace("var(--", "").replace(")", ""));
  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cssVar = `var(--${hex})`;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(`--${hex}`).trim();
  if (computed) {
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }
  const shorthand = hex.startsWith("#") ? hex : `#${hex}`;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(shorthand);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

export function HeatmapChart({
  data,
  config,
  title,
  description,
  dayLabels = DEFAULT_DAY_LABELS,
  hourLabels = DEFAULT_HOUR_LABELS,
  className,
  height = 400,
  minValue = 0,
}: HeatmapChartProps) {
  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center h-[300px]", className)}>
        <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
      </div>
    );
  }

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.value), minValue + 1),
    [data, minValue]
  );

  const cellSize = Math.min((height - 80) / 7, 32);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>

        <div className="relative flex flex-col">
          <div className="flex gap-1 overflow-x-auto pb-2">
            <div className="w-24 shrink-0" />
            {hourLabels.map((hour, i) => (
              <div key={hour} className="w-[32px] shrink-0 text-center text-[10px] text-muted-foreground">
                {i % 2 === 0 ? hour : ""}
              </div>
            ))}
          </div>

          <div className="flex gap-1 overflow-x-auto">
            <div className="w-24 shrink-0 flex flex-col gap-1">
              {dayLabels.map((day) => (
                <div key={day} className="h-[32px] flex items-center justify-end pr-2 text-[11px] text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            <div className="flex gap-1 overflow-x-auto">
              {dayLabels.map((_, dayIndex) => (
                <div key={dayIndex} className="flex flex-col gap-1">
                  {hourLabels.map((_, hourIndex) => {
                    const point = data.find((d) => d.hour === hourIndex && getDayIndex(d.day) === dayIndex);
                    const value = point?.value ?? 0;
                    const color = value > 0 ? getColorForValue(value, minValue, maxValue) : "var(--muted)";

                    return (
                      <div
                        key={hourIndex}
                        className="w-[32px] h-[32px] shrink-0 rounded-sm transition-colors hover:scale-110 hover:z-10"
                        style={{ backgroundColor: value > 0 ? color : "transparent", border: value > 0 ? "none" : "1px dashed var(--border)" }}
                        title={value > 0 ? `${value} bookings` : "No bookings"}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          <div className="flex h-3 w-24 items-center" style={{ background: `linear-gradient(90deg, ${COLOR_STOPS.map((s) => s.color).join(", ")})` }} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function getDayIndex(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getDay();
}