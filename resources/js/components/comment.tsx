import { User } from "@/types"
import AvatarWithInitials from "./avatar-with-initials"
import moment from "moment";

export default function Comment({ comment }: {
    comment: {
        user: User;
        created_at: string;
        body: string;
    }
}) {
    return (
        <div key={comment.id} className='flex gap-3 pl-4'>
            <AvatarWithInitials
                username={comment.user.name}
                avatarSrc={comment.user.profile}
                size='sm'
            />
            <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                    <span className='font-semibold text-sm'>{comment.user.name}</span>
                    <span className='text-xs text-muted-foreground'>
                        {moment(comment.created_at).fromNow()}
                    </span>
                </div>
                <p className='text-sm'>{comment.body}</p>
            </div>
        </div>
    )
}