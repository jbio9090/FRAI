import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { cn } from "@/lib/utils"
import getInitials from "@/lib/getInitials";

function getBackgroundColor(name: string) {
    const colors = [
        "bg-red-500", "bg-pink-500", "bg-purple-500", "bg-indigo-500",
        "bg-blue-500", "bg-cyan-500", "bg-teal-500", "bg-emerald-500",
        "bg-orange-500", "bg-amber-500"
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

const sizeClasses = {
    // 32px container -> 15px text (~47%)
    sm: {
        container: "w-8 h-8",
        text: "text-[15px]"
    },
    // 48px container -> 22px text (~46%)
    md: {
        container: "w-12 h-12",
        text: "text-[22px]"
    },
    // 96px container -> 44px text (~46%)
    lg: {
        container: "w-24 h-24",
        text: "text-[44px]"
    },
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

    const bgColor = getBackgroundColor(username);
    const activeSize = sizeClasses[size];

    return (
        <Avatar className={cn("shrink-0", activeSize.container, className)}>
            <AvatarImage src={src} alt={username} className="object-cover" />
            <AvatarFallback
                className={cn(
                    "flex items-center justify-center font-semibold text-white select-none leading-none",
                    bgColor,
                    activeSize.text
                )}
            >
                {getInitials(username)}
            </AvatarFallback>
        </Avatar>
    )
}