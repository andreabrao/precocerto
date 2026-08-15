// Produtos de fontes diferentes só são agrupados quando a equivalência foi
// revisada. Os demais permanecem separados: é melhor mostrar uma oferta sem
// comparação do que comparar itens de marcas, pesos ou apresentações distintos.
//
// `id` é o SKU canônico que o comparador usa. As descrições originais do
// encarte continuam guardadas na fonte, mas todas as novas publicações de
// folheto geram esse mesmo padrão de SKU.
type ProductAlias = {
  id: string;
  name: string;
  brand: string;
  category: string;
  measure: string;
  sourceIds: readonly string[];
};

export type ProductIdentity = {
  name: string;
  brand: string;
  measure: string;
};

function skuPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    // "500 g", "500g" e "500-g" devem chegar ao mesmo SKU.
    .replace(/(\d)\s+(?=(?:kg|g|ml|l|un)\b)/g, "$1")
    .replace(/(\d+)\s*x\s*(\d+)/g, "$1x$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Chave estável para um produto informado por um folheto revisado.
 *
 * Não remove palavras do nome deliberadamente: isso evita unir versões,
 * sabores ou apresentações diferentes apenas por serem da mesma marca.
 */
export function canonicalProductSku(product: ProductIdentity) {
  const brand = skuPart(product.brand) || "marca-nao-informada";
  const name = skuPart(product.name) || "produto-nao-informado";
  const measure = skuPart(product.measure) || "medida-nao-informada";
  return `sku-${brand}-${name}-${measure}`.slice(0, 140);
}

const aliases: readonly ProductAlias[] = [
  {
    id: "sku-corte-suino-pernil-suino-kg",
    name: "Pernil suíno",
    brand: "Corte suíno",
    category: "Carnes",
    measure: "kg",
    sourceIds: ["rio-verde-pernil-suino-kg", "cristiano-pernil-suino-kg"],
  },
  {
    id: "sku-omo-sabao-em-po-lavagem-perfeita-700g",
    name: "Sabão em pó Lavagem Perfeita",
    brand: "OMO",
    category: "Limpeza",
    measure: "700 g",
    sourceIds: ["rio-verde-sabao-po-omo-700g", "rio-verde-sabao-po-omo-700g-saldao"],
  },
  {
    id: "sku-frimesa-linguica-toscana-kg",
    name: "Linguiça toscana",
    brand: "Frimesa",
    category: "Carnes",
    measure: "kg",
    sourceIds: ["rio-verde-linguica-toscana-frimesa-kg", "ramon-linguica-toscana-frimesa-kg"],
  },
  {
    id: "sku-hortifruti-maca-fuji-kg",
    name: "Maçã Fuji",
    brand: "Hortifruti",
    category: "Hortifruti",
    measure: "kg",
    sourceIds: ["rio-verde-maca-fuji-kg"],
  },
  {
    id: "sku-palmolive-sabonete-fragrancias-85g",
    name: "Sabonete fragrâncias",
    brand: "Palmolive",
    category: "Perfumaria",
    measure: "85 g",
    sourceIds: ["rio-verde-sabonete-palmolive-85g", "rio-verde-sabonete-palmolive-85g-saldao"],
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
