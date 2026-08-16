export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type PilotCoverage = GeoPoint & {
  id: "curitiba" | "itaperucu";
  city: "Curitiba" | "Itaperuçu";
  label: string;
  bounds: { north: number; south: number; east: number; west: number };
};

export type PilotLocality = GeoPoint & {
  id: string;
  city: PilotCoverage["city"];
  label: string;
  aliases: readonly string[];
};

export const DEFAULT_RADIUS_KM = 8;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 15;

// Áreas de cobertura operacional. A sede de Itaperuçu fica em aproximadamente
// -25,22 / -49,35 segundo o mapa municipal do IBGE; os limites são usados
// apenas para decidir em qual cobertura o cliente está, não para geocodificar endereços.
export const pilotCoverage: readonly PilotCoverage[] = [
  {
    id: "curitiba",
    city: "Curitiba",
    label: "Curitiba, PR",
    latitude: -25.429,
    longitude: -49.271,
    bounds: { north: -25.32, south: -25.62, east: -49.16, west: -49.46 },
  },
  {
    id: "itaperucu",
    city: "Itaperuçu",
    label: "Itaperuçu, PR",
    latitude: -25.22,
    longitude: -49.35,
    bounds: { north: -25.08, south: -25.35, east: -49.18, west: -49.54 },
  },
] as const;

// Pontos de referência usados quando a pessoa prefere não compartilhar o GPS.
export const pilotLocalities: readonly PilotLocality[] = [
  { id: "agua-verde", city: "Curitiba", label: "Água Verde, Curitiba", aliases: ["agua verde", "água verde", "80620"], latitude: -25.456, longitude: -49.287 },
  { id: "batel", city: "Curitiba", label: "Batel, Curitiba", aliases: ["batel", "80240"], latitude: -25.441, longitude: -49.283 },
  { id: "portao", city: "Curitiba", label: "Portão, Curitiba", aliases: ["portao", "portão", "81070"], latitude: -25.474, longitude: -49.293 },
  { id: "centro", city: "Curitiba", label: "Centro, Curitiba", aliases: ["centro", "80010"], latitude: -25.429, longitude: -49.271 },
  { id: "itaperucu-centro", city: "Itaperuçu", label: "Centro, Itaperuçu", aliases: ["itaperucu", "itaperuçu", "centro itaperucu", "centro itaperuçu"], latitude: -25.22, longitude: -49.35 },
] as const;

// Mantido como alias para não quebrar integrações já existentes no piloto.
export const curitibaLocalities = pilotLocalities;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolvePilotLocality(value: string) {
  const query = normalize(value);
  if (!query) return undefined;
  return pilotLocalities.find((locality) =>
    normalize(locality.label).includes(query)
    || locality.aliases.some((alias) => normalize(alias) === query),
  );
}

export const resolveCuritibaLocality = resolvePilotLocality;

export function isValidGeoPoint(point: GeoPoint) {
  return Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

export function getPilotCoverageForPoint(point: GeoPoint) {
  if (!isValidGeoPoint(point)) return undefined;
  const matches = pilotCoverage.filter((coverage) =>
    point.latitude <= coverage.bounds.north
    && point.latitude >= coverage.bounds.south
    && point.longitude <= coverage.bounds.east
    && point.longitude >= coverage.bounds.west,
  );
  if (matches.length > 0) {
    return matches.sort((left, right) => distanceInKm(point, left) - distanceInKm(point, right))[0];
  }
  const nearby = pilotCoverage
    .map((coverage) => ({ coverage, distance: distanceInKm(point, coverage) }))
    .filter(({ distance }) => distance <= 25)
    .sort((a, b) => a.distance - b.distance);
  return nearby[0]?.coverage;
}

export function isWithinPilotCoverage(point: GeoPoint) {
  return Boolean(getPilotCoverageForPoint(point));
}

// Alias retrocompatível: a cobertura agora inclui Curitiba e Itaperuçu.
export const isWithinCuritibaPilot = isWithinPilotCoverage;

export function approximatePoint(point: GeoPoint): GeoPoint {
  return {
    latitude: Math.round(point.latitude * 1_000) / 1_000,
    longitude: Math.round(point.longitude * 1_000) / 1_000,
  };
}

export function distanceInKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
