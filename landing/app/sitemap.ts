import type { MetadataRoute } from "next";
import { canonicalUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-19T00:00:00.000Z");
  return [
    { url: canonicalUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: canonicalUrl("/privacidade"), lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: canonicalUrl("/suporte"), lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
