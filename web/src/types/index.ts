export interface BuildingInfo {
  address?: string;
  type?: string;
  year_built?: number;
  material?: string;
  floors?: number;
  area_m2?: number;
  heating?: string;
  roof_type?: string;
  roof_material?: string;
  units?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
  scene_js?: string | null;
  display_scale?: number;
  thumbnail_url?: string | null;
  building_info?: BuildingInfo | null;
  share_token?: string | null;
  bom?: BomItem[];
}

export interface BuildingResult {
  address: string;
  coordinates: { lat: number; lon: number };
  building_info: {
    type: string;
    year_built: number;
    material: string;
    floors: number;
    area_m2: number;
    heating: string;
    roof_type?: string;
    roof_material?: string;
    units?: number;
  };
  confidence: "verified" | "estimated" | "template";
  data_sources: string[];
  scene_js: string;
  bom_suggestion: { material_id: string; quantity: number; unit: string }[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  estimated_cost: number;
  scene_js: string;
  bom: { material_id: string; quantity: number; unit: string }[];
}

export interface Material {
  id: string;
  name: string;
  name_fi: string | null;
  name_en: string | null;
  category_name: string;
  category_name_fi: string | null;
  image_url: string | null;
  pricing: { unit_price: number; unit: string; supplier_name: string; is_primary: boolean }[] | null;
}

export interface BomItem {
  id?: string;
  material_id: string;
  material_name?: string;
  category_name?: string;
  image_url?: string | null;
  quantity: number;
  unit: string;
  unit_price?: number;
  total?: number;
  supplier?: string;
}

export interface PriceRow {
  id: string;
  material_id: string;
  supplier_id: string;
  unit: string;
  unit_price: string;
  currency: string;
  sku: string | null;
  ean: string | null;
  link: string | null;
  is_primary: boolean;
  last_scraped_at: string | null;
  last_verified_at: string | null;
  supplier_name: string;
  supplier_url: string;
  supplier_logo: string | null;
}

export interface MaterialPriceData {
  material_id: string;
  material_name: string;
  prices: PriceRow[];
  cheapest_price: number | null;
  primary_price: number | null;
  savings_per_unit: number;
}

export interface Category {
  id: string;
  display_name: string;
  display_name_fi: string | null;
  sort_order: number;
  hidden: boolean;
}

export interface PriceHistoryRow {
  id: string;
  pricing_id: string;
  unit_price: string;
  scraped_at: string;
  source: string;
  supplier_name: string;
  supplier_id: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
