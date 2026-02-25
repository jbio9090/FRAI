import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
};

export function recommendedActionToPresentTense(action: string): string {
  let word = action;
  switch (action) {
    case "Denied":
      word = "Deny";
      break;
  }
  return word;
}