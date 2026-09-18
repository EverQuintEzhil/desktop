interface Props {
    /** Counted from one page of the unread feed spanning every routine, so runs past that page raise no chip. */
    count: number;
}

const RoutineUnreadChip = ({ count }: Props) => {
    if (count <= 0) return null;

    return (
        <span className="routine-unread-chip shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-text-secondary">
            {count} new
        </span>
    );
};

export default RoutineUnreadChip;
