import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    const base = chroma(randomColor({ seed: word }));

    return base.get('oklch.h');
}