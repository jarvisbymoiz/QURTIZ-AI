type Status = "planning" | "generating" | "active" | "completed" | "cancelled";
export function campaignDeliveryStatus(
  current: Status,
  platforms: string[],
  items: { contentItemId: string | null }[],
  deliveries: {
    contentItemId: string;
    platform: string;
    status: string;
    providerPostId: string | null;
  }[],
): Status {
  if (current === "cancelled" || current === "generating") return current;
  const complete =
    platforms.length > 0 &&
    items.length > 0 &&
    items.every(
      (i) =>
        i.contentItemId &&
        platforms.every((p) =>
          deliveries.some(
            (j) =>
              j.contentItemId === i.contentItemId &&
              j.platform === p &&
              j.status === "published" &&
              j.providerPostId,
          ),
        ),
    );
  return complete
    ? "completed"
    : items.some((i) => i.contentItemId)
      ? "active"
      : "planning";
}
