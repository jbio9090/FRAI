import chroma from "chroma-js";
import randomColor from "randomcolor";

export default function wordToColor(word: string) {
    return {
        text: chroma(randomColor(
            { seed: word }
        )).darken(2).hex(),
        background: chroma(randomColor(
            { seed: word }
        )).brighten().hex(),
    };
}