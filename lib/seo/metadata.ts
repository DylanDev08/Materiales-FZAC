import type { Metadata } from "next";
import {
  SITE_NAME,
  SOCIAL_IMAGE,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_WIDTH
} from "@/lib/seo/site";

type PublicPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
};

export function publicPageMetadata({
  title,
  description,
  path,
  image = SOCIAL_IMAGE,
  imageAlt = "Materiales para construcción disponibles en Materiales FZAC"
}: PublicPageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      images: [{ url: image, width: SOCIAL_IMAGE_WIDTH, height: SOCIAL_IMAGE_HEIGHT, alt: imageAlt }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image]
    }
  };
}

export function privatePageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true
    }
  };
}
