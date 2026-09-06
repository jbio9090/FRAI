export type RequestStatusValue =
  | "Pending"
  | "Approved"
  | "Denied"
  | "Conditionally Approved"
  | "On Hold"
  | "For Reschedule"
  | "Partially Approved";

export type RequestStatusKey =
  | "pending"
  | "approved"
  | "denied"
  | "conditionally_approved"
  | "on_hold"
  | "for_reschedule"
  | "partially_approved";

export function formatRequestStatus(status: string): string {
  const statusMap: Record<RequestStatusKey, string> = {
    pending: "Pending",
    approved: "Approved",
    denied: "Denied",
    conditionally_approved: "Conditionally Approved",
    on_hold: "On Hold",
    for_reschedule: "For Reschedule",
    partially_approved: "Partially Approved",
  };

  return statusMap[status as RequestStatusKey] ?? formatRequestStatusKey(status);
}

export function formatRequestStatusKey(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}