import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const isDark = document.documentElement.classList.contains("dark");
    const base = chroma(randomColor({ seed: word, luminosity: "bright" }));

    if (isDark) {
        return {
            text: base.brighten(2).desaturate(0.5).css("oklch"),
            background: base.darken(3).desaturate(1).alpha(0.3).css("oklch"),
        };
    }

    return {
        text: base.darken(2).saturate(1).css("oklch"),
        background: base.brighten(2).desaturate(0.5).css("oklch"),
    };
}