// Produtos de fontes diferentes só são agrupados quando a equivalência foi
// revisada. Os demais permanecem separados: é melhor mostrar uma oferta sem
// comparação do que comparar itens de marcas, pesos ou apresentações distintos.
type ProductAlias = {
  id: string;
  name: string;
  brand: string;
  category: string;
  measure: string;
  sourceIds: readonly string[];
};

const aliases: readonly ProductAlias[] = [
  {
    id: "pernil-suino-kg",
    name: "Pernil suíno",
    brand: "Corte suíno",
    category: "Carnes",
    measure: "kg",
    sourceIds: ["rio-verde-pernil-suino-kg", "cristiano-pernil-suino-kg"],
  },
  {
    id: "sabao-po-omo-700g",
    name: "Sabão em pó Lavagem Perfeita",
    brand: "OMO",
    category: "Limpeza",
    measure: "700 g",
    sourceIds: ["rio-verde-sabao-po-omo-700g", "rio-verde-sabao-po-omo-700g-saldao"],
  },
];

const aliasBySourceId = new Map(aliases.flatMap((alias) => alias.sourceIds.map((sourceId) => [sourceId, alias] as const)));
const aliasById = new Map(aliases.map((alias) => [alias.id, alias] as const));

export function comparableProductId(sourceProductId: string) {
  return aliasBySourceId.get(sourceProductId)?.id ?? sourceProductId;
}

export function sourceProductIdsFor(comparisonProductId: string) {
  return aliasById.get(comparisonProductId)?.sourceIds ?? [comparisonProductId];
}

export function comparableProductMetadata(sourceProductId: string, fallback: { name: string; brand: string; category: string; measure: string }) {
  const alias = aliasBySourceId.get(sourceProductId);
  return alias ? { id: alias.id, name: alias.name, brand: alias.brand, category: alias.category, measure: alias.measure } : { id: sourceProductId, ...fallback };
}
