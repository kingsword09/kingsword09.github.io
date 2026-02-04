import { site } from "../config/site";
import { withBase } from "./urls";

export function absoluteUrl(pathname: string): string {
  return new URL(withBase(pathname), site.url).toString();
}

