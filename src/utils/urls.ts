export function withBase(pathname: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const baseNormalized = base.endsWith("/") ? base : `${base}/`;
  const pathNormalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return `${baseNormalized}${pathNormalized}`;
}

