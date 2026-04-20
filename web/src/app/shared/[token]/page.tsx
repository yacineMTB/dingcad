import type { Metadata } from "next";
import SharedProjectContent from "./SharedProjectContent";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SharedProject {
  name: string;
  description: string;
  thumbnail_url?: string | null;
}

async function fetchSharedProject(token: string): Promise<SharedProject | null> {
  try {
    const res = await fetch(`${API_URL}/shared/${token}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const project = await fetchSharedProject(token);

  if (!project) {
    return {
      title: "Jaettu projekti | Helscoop",
      description: "Suunnittele remonttisi 3D:ssa Helscoopilla.",
    };
  }

  const title = project.name;
  const description =
    project.description ||
    "Remonttiprojekti suunniteltu Helscoopilla \u2014 3D-mallinnus, materiaalit ja kustannusarvio.";
  const ogImage = project.thumbnail_url || "https://helscoop.fi/og-default.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fi_FI",
      siteName: "Helscoop",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharedProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedProjectContent token={token} />;
}
