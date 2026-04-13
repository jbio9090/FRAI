import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const base = chroma(
        randomColor({
            seed: word,
            luminosity: "light", // already nudges toward pastel
        })
    );

    const pastel = base
        .set("oklch.l", 0.85)
        .set("oklch.c", 0.13);

    return {
        text: pastel.darken(1.5).css("oklch"),
        background: pastel.alpha(0.4).css("oklch"),
    };
}