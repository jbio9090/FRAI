import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const base = chroma(randomColor({ seed: word, luminosity: "light" }));
    const hue = base.get("oklch.h") || 0;
    const chro = 0.12;

    return {
        "--tag-h": String(hue),
        "--tag-c": String(chro),
    } as React.CSSProperties;
}