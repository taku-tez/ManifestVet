import { Rule } from "./types";
import { mv1Rules } from "./mv1";
import { mv2Rules } from "./mv2";
import { mv3Rules } from "./mv3";
import { mv4Rules } from "./mv4";
import { mv5Rules } from "./mv5";
import { mv6Rules } from "./mv6";

export const ALL_RULES: Rule[] = [
  ...mv1Rules,
  ...mv2Rules,
  ...mv3Rules,
  ...mv4Rules,
  ...mv5Rules,
  ...mv6Rules,
];
