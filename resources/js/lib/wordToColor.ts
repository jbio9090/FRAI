import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const isDark = document.documentElement.classList.contains("dark");
    const base = chroma(randomColor({ seed: word, luminosity: "light" }));
    return {
        text: base.darken(2).saturate(-0.5).css("oklch"),
        background: isDark
            ? base.darken(1.5).saturate(-0.5).mix("black", 0.5).css("oklch")
            : base.mix("white", 0.5).saturate(-0.3).css("oklch"),
    };
}