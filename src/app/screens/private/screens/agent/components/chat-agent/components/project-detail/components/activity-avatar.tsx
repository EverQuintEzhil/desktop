export interface Props {
    label: string;
}

const ActivityAvatar = ({ label }: Props) => (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {label.trim().charAt(0).toUpperCase() || '?'}
    </span>
);

export default ActivityAvatar;
