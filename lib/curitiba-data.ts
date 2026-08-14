export type CuritibaProduct = {
  id: string;
  name: string;
  brand: string;
  category: "Essenciais" | "Limpeza" | "Bebidas" | "Hortifruti";
  measure: string;
  listPriceCents: number;
};

export const curitibaStores = [
  { id: "muffato-portao", name: "Muffato Portão", neighborhood: "Portão", latitude: -25.474, longitude: -49.293 },
  { id: "condor-agua-verde", name: "Condor Água Verde", neighborhood: "Água Verde", latitude: -25.45, longitude: -49.285 },
  { id: "festval-batel", name: "Festval Batel", neighborhood: "Batel", latitude: -25.441, longitude: -49.283 },
] as const;

// Pontos de coleta comunitária não entram na comparação até terem uma fonte
// validada. Eles permitem receber etiquetas de uma nova cidade sem inventar
// uma rede ou preço no resultado para o consumidor.
export const communityCollectionStores = [
  { id: "community-curitiba", name: "Mercado informado pela comunidade", city: "Curitiba", neighborhood: "A confirmar", latitude: -25.429, longitude: -49.271 },
  { id: "community-itaperucu", name: "Mercado informado pela comunidade", city: "Itaperuçu", neighborhood: "A confirmar", latitude: -25.22, longitude: -49.35 },
] as const;

export const curitibaProducts: CuritibaProduct[] = [
  { id: "cafe-melitta-500g", name: "Café Melitta tradicional", brand: "Melitta", category: "Essenciais", measure: "500 g", listPriceCents: 2249 },
  { id: "arroz-parboilizado-5kg", name: "Arroz parboilizado", brand: "Tio João", category: "Essenciais", measure: "5 kg", listPriceCents: 2999 },
  { id: "leite-integral-1l", name: "Leite integral", brand: "Lider", category: "Bebidas", measure: "1 L", listPriceCents: 569 },
  { id: "detergente-concentrado-500ml", name: "Detergente concentrado", brand: "Ypê", category: "Limpeza", measure: "500 ml", listPriceCents: 989 },
  { id: "banana-caturra-kg", name: "Banana caturra", brand: "Hortifruti", category: "Hortifruti", measure: "1 kg", listPriceCents: 749 },
  { id: "tomate-italiano-kg", name: "Tomate italiano", brand: "Hortifruti", category: "Hortifruti", measure: "1 kg", listPriceCents: 1199 },
];

const pricesByStore: Record<string, number[]> = {
  "muffato-portao": [1899, 2489, 479, 749, 599, 849],
  "condor-agua-verde": [2049, 2699, 489, 799, 629, 879],
  "festval-batel": [2299, 2899, 529, 899, 699, 999],
};

export const seedPriceObservations = curitibaStores.flatMap((store) =>
  curitibaProducts.map((product, index) => ({
    id: `seed-${store.id}-${product.id}`,
    storeId: store.id,
    productId: product.id,
    priceCents: pricesByStore[store.id][index],
  })),
);
