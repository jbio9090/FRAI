import { cn } from '@/lib/utils';

interface ChamferCardProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'sm' | 'md' | 'lg';
    /** Solid fill (no hairline): use bg-primary / bg-card etc. on the element */
    plain?: boolean;
}

/**
 * A card with the chamfered corner cut. Renders a 1px hairline that
 * follows the cut edge. Pair with `size` to scale the cut.
 */
export default function ChamferCard({ className, size = 'md', plain = false, children, ...props }: ChamferCardProps) {
    if (plain) {
        return (
            <div className={cn('bp-chamfer', size === 'lg' && 'bp-chamfer-lg', className)} {...props}>
                {children}
            </div>
        );
    }

    return (
        <div className={cn('bp-card', size === 'lg' && 'bp-chamfer-lg', className)} {...props}>
            <div className="bp-card-inner">{children}</div>
        </div>
    );
}
