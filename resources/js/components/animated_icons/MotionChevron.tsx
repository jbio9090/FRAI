import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

const Chevron = motion(ChevronDown);

interface ChevronProps {
    openCollapsible: boolean;
    size?: number;
    className?: string;
}

export default function MotionChevron({ openCollapsible, size = 16, className = "" }: ChevronProps) {
    return (<Chevron
        size={size}
        animate={{
            rotate: openCollapsible ? 180 : 0,
            transition: { duration: 0.15, ease: "easeInOut" },
        }}
        className={className}
    />)
}
