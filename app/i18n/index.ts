import { en } from "./en";

export type Strings = typeof en;

// English only for now. To add a language, create e.g. fr.ts exporting an
// object that `satisfies Strings`, then choose the locale here.
export const strings: Strings = en;
