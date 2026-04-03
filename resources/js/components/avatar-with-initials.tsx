import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

const sizeClasses = {
    sm: "text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-24 h-24 text-lg",
} as const;

export default function AvatarWithInitials({ username, avatarSrc, previewSrc, className, size = "md" }: {
    username: string;
    avatarSrc?: string;
    previewSrc?: string | null;
    className?: string;
    size?: keyof typeof sizeClasses;
}) {
    const src = previewSrc
        ?? (avatarSrc && avatarSrc !== 'default.png' ? `/storage/profiles/${avatarSrc}` : undefined);

    return (
        <Avatar className={cn("shrink-0", sizeClasses[size], className)}>
            <AvatarImage src={src} alt={username} className="object-cover" />
            <AvatarFallback className="text-inherit">{getInitials(username)}</AvatarFallback>
        </Avatar>
    )
}