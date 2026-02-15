interface UpcomingEmptyStateProps {
  itemType: string;
}

export default function UpcomingEmptyState({ itemType }: UpcomingEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
      no upcoming {itemType} found.
    </div>
  );
}
