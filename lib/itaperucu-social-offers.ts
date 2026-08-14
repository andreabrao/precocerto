export type ItaperucuSocialOffer = {
  id: string;
  storeId: string;
  name: string;
  brand: string;
  category: string;
  measure: string;
  priceCents: number;
  artifactId: string;
  startsAt: string;
  expiresAt: string;
};

const STARTS_14 = "2026-08-14T03:00:00.000Z";
const ENDS_15 = "2026-08-16T02:59:59.000Z";
const ENDS_16 = "2026-08-17T02:59:59.000Z";
const STARTS_15 = "2026-08-15T03:00:00.000Z";

const offer = (
  id: string,
  storeId: string,
  name: string,
  brand: string,
  category: string,
  measure: string,
  priceCents: number,
  artifactId: string,
  startsAt: string,
  expiresAt: string,
): ItaperucuSocialOffer => ({ id, storeId, name, brand, category, measure, priceCents, artifactId, startsAt, expiresAt });

export const itaperucuSocialStores = [
  {
    id: "mercado-ramon-itaperucu-jardim-benato",
    name: "Mercado Ramon",
    city: "Itaperuçu",
    neighborhood: "Jardim Benato",
    // A arte fornece o endereço, mas não coordenadas. Usa a referência do
    // município até que a localização exata seja confirmada.
    latitude: -25.22,
    longitude: -49.35,
  },
  {
    id: "mercado-cristiano-itaperucu-sao-domingos",
    name: "Mercado Cristiano",
    city: "Itaperuçu",
    neighborhood: "São Domingos",
    latitude: -25.22,
    longitude: -49.35,
  },
] as const;

export const itaperucuSocialArtifacts = [
  { id: "rio-verde-social-20260814-bebidas", capturedAt: "2026-08-14T16:58:17.000Z", checksum: "4dbf4813039bba25a8ab649d94a8f03a72b37f87f04341e068370b1fea7b47cf" },
  { id: "rio-verde-social-20260814-carnes", capturedAt: "2026-08-14T16:58:17.000Z", checksum: "8f93a5905485b89ab48829d155359ba6a2882bad99f65f024cc71a07c67bedeb" },
  { id: "rio-verde-social-20260815-saldao", capturedAt: "2026-08-14T16:58:17.000Z", checksum: "51b0153b539d09ee7dd0b53eb1b7c2f475d7f4033e0f84ebf424e89243c3b635" },
  { id: "mercado-ramon-social-20260814", capturedAt: "2026-08-14T16:58:18.000Z", checksum: "225d9b491f44397b409e7129f299de071679b073eb9d13367c31ad1de95af44e" },
  { id: "mercado-cristiano-social-20260814", capturedAt: "2026-08-14T16:58:18.000Z", checksum: "36dfca90479d95afda15eb875489bd4bb1a3a48622a0c81d0a605661d7528449" },
] as const;

const RIO_VERDE = "rio-verde-itaperucu-centro";
const RAMON = "mercado-ramon-itaperucu-jardim-benato";
const CRISTIANO = "mercado-cristiano-itaperucu-sao-domingos";

export const itaperucuSocialOffers: ItaperucuSocialOffer[] = [
  // Rio Verde — bebidas, válidas de 14 a 16/08
  offer("rio-verde-amstel-puro-malte-350ml", RIO_VERDE, "Cerveja puro malte lata", "Amstel", "Bebidas", "350 ml", 299, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-budweiser-pack-12x350ml-promocao", RIO_VERDE, "Cerveja Lager pack promoção", "Budweiser", "Bebidas", "12 x 350 ml", 4369, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-brahma-retornavel-600ml", RIO_VERDE, "Cerveja Chopp Pilsen retornável", "Brahma", "Bebidas", "600 ml", 249, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-stella-artois-330ml", RIO_VERDE, "Cerveja puro malte long neck", "Stella Artois", "Bebidas", "330 ml", 549, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-smirnoff-ice-275ml", RIO_VERDE, "Bebida alcoólica Ice", "Smirnoff", "Bebidas", "275 ml", 499, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-aguardente-51-965ml-social", RIO_VERDE, "Aguardente", "51", "Bebidas", "965 ml", 1199, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-vinho-campo-largo-750ml", RIO_VERDE, "Vinho de mesa garrafa", "Campo Largo", "Bebidas", "750 ml", 1349, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-vodka-smirnoff-998ml", RIO_VERDE, "Vodka tradicional", "Smirnoff", "Bebidas", "998 ml", 2999, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-whisky-jameson-750ml", RIO_VERDE, "Whisky", "Jameson", "Bebidas", "750 ml", 6999, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-gin-gibsons-700ml", RIO_VERDE, "Gin London Dry", "Gibson's", "Bebidas", "700 ml", 3499, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-whisky-jim-beam-1l", RIO_VERDE, "Whisky tipos", "Jim Beam", "Bebidas", "1 L", 8999, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-energetico-red-horse-2l", RIO_VERDE, "Energético sabores PET", "Red Horse", "Bebidas", "2 L", 799, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-coca-cola-zero-2l", RIO_VERDE, "Refrigerante sem açúcar PET", "Coca-Cola", "Bebidas", "2 L", 1049, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-agua-ouro-fino-500ml", RIO_VERDE, "Água mineral sem gás", "Ouro Fino", "Bebidas", "500 ml", 99, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-engov-after-250ml", RIO_VERDE, "Engov After sabores", "Engov", "Bebidas", "250 ml", 699, "rio-verde-social-20260814-bebidas", STARTS_14, ENDS_16),
  offer("rio-verde-coxao-mole-bife-kg", RIO_VERDE, "Coxão mole bovino bife", "Rio Verde", "Carnes", "kg", 3899, "rio-verde-social-20260814-carnes", STARTS_14, ENDS_15),

  // Rio Verde — Saldão de sábado e domingo, 15 e 16/08
  offer("rio-verde-leite-tirol-semidesnatado-1l", RIO_VERDE, "Leite UHT semidesnatado tampa rosca", "Tirol", "Laticínios", "1 L", 449, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-farinha-orquidea-5kg", RIO_VERDE, "Farinha de trigo tipo 1", "Orquídea", "Mercearia", "5 kg", 1499, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-arroz-sabor-sul-parboilizado-5kg", RIO_VERDE, "Arroz parboilizado", "Sabor Sul", "Mercearia", "5 kg", 1299, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-cafe-damasco-500g", RIO_VERDE, "Café a vácuo tradicional ou extraforte", "Damasco", "Mercearia", "500 g", 2299, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-leite-condensado-frimesa-semi-395g", RIO_VERDE, "Leite condensado semidesnatado TP", "Frimesa", "Laticínios", "395 g", 479, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-maca-fuji-kg", RIO_VERDE, "Maçã Fuji", "Hortifruti", "Hortifruti", "kg", 249, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-coxa-sobrecoxa-congelada-kg", RIO_VERDE, "Coxa e sobrecoxa congelada", "Rio Verde", "Carnes", "kg", 699, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-pepino-poli-300g", RIO_VERDE, "Pepino em conserva tradicional", "Poli", "Mercearia", "300 g", 879, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-feijao-pontarollo-1kg", RIO_VERDE, "Feijão preto", "Pontarollo", "Mercearia", "1 kg", 549, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-bono-240g", RIO_VERDE, "Biscoito recheado chocolate ou morango", "Bono", "Mercearia", "240 g", 99, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-cebola-nacional-kg", RIO_VERDE, "Cebola nacional", "Hortifruti", "Hortifruti", "kg", 399, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-costela-bovina-resfriada-kg", RIO_VERDE, "Costela bovina resfriada", "Rio Verde", "Carnes", "kg", 2299, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-leite-fermentado-chamyto-450g", RIO_VERDE, "Leite fermentado", "Chamyto", "Laticínios", "450 g", 649, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-extrato-stella-doro-300g", RIO_VERDE, "Extrato de tomate sachê tradicional", "Stella d'Oro", "Mercearia", "300 g", 199, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-maionese-salada-500g", RIO_VERDE, "Maionese tradicional pote", "Salada", "Mercearia", "500 g", 499, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-tomate-saladet-kg", RIO_VERDE, "Tomate saladet", "Hortifruti", "Hortifruti", "kg", 499, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-linguica-toscana-frimesa-kg", RIO_VERDE, "Linguiça toscana resfriada", "Frimesa", "Carnes", "kg", 1699, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-petra-puro-malte-350ml", RIO_VERDE, "Cerveja puro malte lata", "Petra", "Bebidas", "350 ml", 279, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-petit-suisse-elege-360g", RIO_VERDE, "Petit suisse sabores", "Elegê", "Laticínios", "360 g", 529, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-uva-thompson-500g", RIO_VERDE, "Uva Thompson sem semente", "Hortifruti", "Hortifruti", "500 g", 799, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-sassami-congelado-kg", RIO_VERDE, "Filé de sassami congelado", "Rio Verde", "Carnes", "kg", 1299, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-sabao-po-omo-700g-saldao", RIO_VERDE, "Sabão em pó Lavagem Perfeita", "OMO", "Limpeza", "700 g", 1199, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-sabonete-palmolive-85g-saldao", RIO_VERDE, "Sabonete fragrâncias", "Palmolive", "Perfumaria", "85 g", 249, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),
  offer("rio-verde-vinho-collina-750ml", RIO_VERDE, "Vinho de mesa tipos", "Collina", "Bebidas", "750 ml", 1099, "rio-verde-social-20260815-saldao", STARTS_15, ENDS_16),

  // Mercado Ramon — Jardim Benato, Itaperuçu, válido de 14 a 16/08
  offer("ramon-contra-file-balde-2kg", RAMON, "Contra filé bovino com osso temperado no balde", "Mercado Ramon", "Carnes", "2 kg", 9999, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-file-mignon-angus-kg", RAMON, "Filé mignon bovino especial Angus com osso", "Mercado Ramon", "Carnes", "kg", 4999, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-linguica-toscana-frimesa-kg", RAMON, "Linguiça toscana", "Frimesa", "Carnes", "kg", 1899, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-coxinha-asa-temperada-kg", RAMON, "Coxinha da asa temperada", "Mercado Ramon", "Carnes", "kg", 1499, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-copa-lombo-suino-kg", RAMON, "Copa lombo suíno temperado", "Mercado Ramon", "Carnes", "kg", 1999, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-kit-coca-fanta-2x2l", RAMON, "Kit Coca-Cola Original e Fanta Laranja", "Coca-Cola/Fanta", "Bebidas", "2 x 2 L", 1699, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-original-pack-12x300ml", RAMON, "Cerveja Original garrafa One Way", "Original", "Bebidas", "12 x 300 ml", 4199, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-skol-pack-15x269ml", RAMON, "Cerveja Skol Pilsen lata", "Skol", "Bebidas", "15 x 269 ml", 4199, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),
  offer("ramon-carvao-zacote-3kg", RAMON, "Carvão vegetal especial", "Zacote", "Bazar", "3 kg", 1399, "mercado-ramon-social-20260814", STARTS_14, ENDS_16),

  // Mercado Cristiano — São Domingos, Itaperuçu, válido até 15/08
  offer("cristiano-miolo-alcatra-kg", CRISTIANO, "Miolo da alcatra", "Mercado Cristiano", "Carnes", "kg", 4899, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-ponta-alcatra-kg", CRISTIANO, "Ponta de alcatra", "Mercado Cristiano", "Carnes", "kg", 2599, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-linguica-frimesa-kg", CRISTIANO, "Linguiça Frimesa", "Frimesa", "Carnes", "kg", 1899, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-contra-file-osso-kg", CRISTIANO, "Contra filé com osso fresco", "Mercado Cristiano", "Carnes", "kg", 3999, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-pernil-suino-kg", CRISTIANO, "Pernil suíno", "Mercado Cristiano", "Carnes", "kg", 999, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-cafe-caboclo-500g", CRISTIANO, "Café tradicional", "Caboclo", "Mercearia", "500 g", 2199, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-banha-frimesa-3kg", CRISTIANO, "Banha", "Frimesa", "Mercearia", "3 kg", 2699, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-macarrao-floriani", CRISTIANO, "Macarrão", "Floriani", "Mercearia", "pacote", 499, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-skol-pack", CRISTIANO, "Cerveja Skol pack", "Skol", "Bebidas", "pack", 3799, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-sol-longneck-pack", CRISTIANO, "Cerveja Sol long neck pack", "Sol", "Bebidas", "pack", 2999, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-heineken-longneck-pack", CRISTIANO, "Cerveja Heineken long neck pack", "Heineken", "Bebidas", "pack", 2699, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-refri-branco-2l", CRISTIANO, "Refrigerante branco", "Mercado Cristiano", "Bebidas", "2 L", 499, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
  offer("cristiano-extrato-elefante-500g", CRISTIANO, "Extrato de tomate", "Elefante", "Mercearia", "500 g", 599, "mercado-cristiano-social-20260814", STARTS_14, ENDS_15),
];
