export interface FishSpecies {
  id: string;
  name: string;
  minWeightKg: number;
  maxWeightKg: number;
  pullFactor: number;
  regularPricePerKg: number;
  trophyPricePerKg: number;
  trophyWeightKg: number;
  chance: number;
}

export interface LocationData {
  id: string;
  name: string;
  mapX: number;
  mapY: number;
  sceneImage: string;
  fishes: FishSpecies[];
}

export const LOCATIONS: LocationData[] = [
  {
    id: 'gold_lake',
    name: 'Золотая рыбка',
    mapX: 70,
    mapY: 58,
    sceneImage: '/src/assets/locations/gold-lake.svg',
    fishes: [
      { id: 'karas', name: 'Карась', minWeightKg: 0.7, maxWeightKg: 3.8, pullFactor: 0.85, regularPricePerKg: 75, trophyPricePerKg: 210, trophyWeightKg: 2.8, chance: 44 },
      { id: 'lesh', name: 'Лещ', minWeightKg: 1.4, maxWeightKg: 5.5, pullFactor: 1.05, regularPricePerKg: 95, trophyPricePerKg: 260, trophyWeightKg: 4.2, chance: 32 },
      { id: 'pike', name: 'Щука', minWeightKg: 2.1, maxWeightKg: 8.5, pullFactor: 1.35, regularPricePerKg: 120, trophyPricePerKg: 340, trophyWeightKg: 6.2, chance: 19 },
      { id: 'catfish', name: 'Сом', minWeightKg: 4, maxWeightKg: 12, pullFactor: 1.65, regularPricePerKg: 170, trophyPricePerKg: 430, trophyWeightKg: 8.5, chance: 5 },
    ],
  },
  {
    id: 'forest_pond',
    name: 'Лесной пруд',
    mapX: 63,
    mapY: 52,
    sceneImage: '/src/assets/locations/forest-pond.svg',
    fishes: [
      { id: 'okun', name: 'Окунь', minWeightKg: 0.3, maxWeightKg: 1.5, pullFactor: 0.75, regularPricePerKg: 65, trophyPricePerKg: 180, trophyWeightKg: 1.1, chance: 55 },
      { id: 'plotva', name: 'Плотва', minWeightKg: 0.2, maxWeightKg: 1.2, pullFactor: 0.65, regularPricePerKg: 55, trophyPricePerKg: 140, trophyWeightKg: 0.85, chance: 45 },
    ],
  },
];
