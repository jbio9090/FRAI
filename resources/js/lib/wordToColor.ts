import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const isDark = document.documentElement.classList.contains("dark");
    const base = chroma(randomColor({ seed: word }));

    if (isDark) {
        return {
            text: base.set("oklch.l", 0.85).set("oklch.c", 0.04).css("oklch"),
            background: base.set("oklch.l", 0.25).set("oklch.c", 0.03).alpha(0.4).css("oklch"),
        };
    }

    return {
        text: base.set("oklch.l", 0.35).set("oklch.c", 0.08).css("oklch"),
        background: base.set("oklch.l", 0.95).set("oklch.c", 0.03).css("oklch"),
    };
}