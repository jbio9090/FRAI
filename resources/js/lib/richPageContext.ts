export type RichContext = Record<string, unknown> | null;

let current: RichContext = null;

export function setRichPageContext(ctx: RichContext) {
    current = ctx;
}

export function getRichPageContext(): RichContext {
    return current;
}

export function clearRichPageContext() {
    current = null;
}
