import {cn} from "../../lib/utils";
import {stateBadgeClassName, type TableProgressCard} from "../../domain/gtfsWorkbench";

type TableProgressCardViewProps = {
  card: TableProgressCard;
};

export function TableProgressCardView({card}: TableProgressCardViewProps): JSX.Element {
  const active = card.state === "running";

  return (
    <div className={cn("rounded-md border border-black bg-white px-2 py-2", active && "animate-pulse")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold tracking-wide text-black" title={card.name}>
          {card.name}
        </p>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            stateBadgeClassName(card.state),
          )}
        >
          {card.state}
        </span>
      </div>
    </div>
  );
}
