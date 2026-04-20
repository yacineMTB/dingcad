"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, getToken } from "@/lib/api";
import LoginForm from "@/components/LoginForm";
import AddressSearch from "@/components/AddressSearch";
import FeatureHighlights from "@/components/FeatureHighlights";
import LandingFooter from "@/components/LandingFooter";
import ProjectList from "@/components/ProjectList";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { BuildingResult } from "@/types";

const BUILDING_TYPE_LABELS: Record<string, Record<string, string>> = {
  fi: { omakotitalo: "Omakotitalo", rivitalo: "Rivitalo", kerrostalo: "Kerrostalo", paritalo: "Paritalo" },
  en: { omakotitalo: "Detached house", rivitalo: "Terraced house", kerrostalo: "Apartment block", paritalo: "Semi-detached" },
};

export default function Home() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [pendingBuilding, setPendingBuilding] = useState<BuildingResult | null>(null);
  const { track } = useAnalytics();

  useEffect(() => {
    if (getToken()) {
      api.me().then(() => setLoggedIn(true)).catch(() => setToken(null));
    }
  }, []);

  async function handleCreateFromBuilding(building: BuildingResult) {
    if (!loggedIn) {
      setPendingBuilding(building);
      return;
    }
    await createProjectFromBuilding(building);
  }

  async function createProjectFromBuilding(building: BuildingResult) {
    track("project_created", { source: "address", building_type: building.building_info.type });
    const buildingTypeLabels = BUILDING_TYPE_LABELS.fi;
    const project = await api.createProject({
      name: building.address,
      description: `${buildingTypeLabels[building.building_info.type] || building.building_info.type}, ${building.building_info.year_built}, ${building.building_info.area_m2} m²`,
      scene_js: building.scene_js,
    });
    if (building.bom_suggestion.length > 0) {
      await api.saveBOM(project.id, building.bom_suggestion);
    }
    router.push(`/project/${project.id}`);
  }

  async function handleLogin() {
    setLoggedIn(true);
    if (pendingBuilding) {
      await createProjectFromBuilding(pendingBuilding);
      setPendingBuilding(null);
    }
  }

  if (!loggedIn) {
    return (
      <>
        <LoginForm
          onLogin={handleLogin}
          pendingBuilding={pendingBuilding}
          addressSearch={
            <AddressSearch onCreateProject={handleCreateFromBuilding} compact />
          }
        />
        <FeatureHighlights />
        <LandingFooter />
      </>
    );
  }

  return (
    <div>
      <ProjectList onCreateFromBuilding={handleCreateFromBuilding} />
    </div>
  );
}
