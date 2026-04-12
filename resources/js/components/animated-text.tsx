import { motion } from "motion/react";

export default function AnimatedText({ label = "Analyzing Request...", italize = false }: { label?: string, italize?: boolean }) {
    const colors = [
        "#8e8e8e",
        "#484848",
    ];

    return (
        <span style={{ display: "inline-block", position: "relative", overflow: "hidden" }} className={"font-semibold" + (italize ? " italic" : "")}>
            <span style={{ visibility: "hidden" }}>{label}</span>
            <motion.span
                className="absolute inset-0"
                style={{
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                }}
                animate={{
                    backgroundImage: colors.map(
                        (c, i) =>
                            `linear-gradient(90deg, ${colors[Math.max(0, i - 1)]} 0%, ${c} 50%, ${colors[Math.min(colors.length - 1, i + 1)]} 100%)`
                    ),
                    backgroundPosition: ["-200% center", "200% center"],
                }}
                transition={{
                    backgroundImage: {
                        duration: 4,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "mirror",
                    },
                    backgroundPosition: {
                        duration: 1.8,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "loop",
                    },
                }}
            >
                {label}
            </motion.span>
        </span>
    );
}