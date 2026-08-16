import { publicUrl } from "@/lib/client-config";

export type StoreOffer = {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  measure: string;
  priceCents: number;
  expiresAt: string;
  confidence: number;
  artifactId: string | null;
};

export type StoreOffersStatus = "idle" | "loading" | "ready" | "error";

type StoreSummary = {
  id: string;
  name: string;
};

const flyerImageByArtifactId: Record<string, string> = {
  "rio-verde-social-20260814-bebidas": "encartes/rio-verde-bebidas.jpeg",
  "rio-verde-social-20260814-carnes": "encartes/rio-verde-carnes.jpeg",
  "rio-verde-social-20260815-saldao": "encartes/rio-verde-saldao.jpeg",
  "mercado-ramon-social-20260814": "encartes/mercado-ramon.jpeg",
  "mercado-cristiano-social-20260814": "encartes/mercado-cristiano.jpeg",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

function formatValidity(expiresAt: string) {
  return `Válida até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(expiresAt))}`;
}

export function StoreOffersPanel({
  store,
  offers,
  status,
  onClose,
}: {
  store?: StoreSummary;
  offers: StoreOffer[];
  status: StoreOffersStatus;
  onClose: () => void;
}) {
  if (!store || status === "idle") return null;

  return (
    <section className="store-offers-panel" aria-live="polite" aria-label={`Promoções de ${store.name}`}>
      <div className="store-offers-heading">
        <div>
          <p className="eyebrow">PROMOÇÕES DO MERCADO</p>
          <h3>{store.name}</h3>
          <span>{status === "ready" ? `${offers.length} ofertas ativas encontradas` : "Consultando ofertas ativas"}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar promoções do mercado">×</button>
      </div>

      {status === "loading" && <p className="store-offers-message">Buscando preços e imagens das promoções…</p>}
      {status === "error" && <p className="store-offers-message error">Não foi possível carregar as promoções agora. Tente novamente.</p>}
      {status === "ready" && offers.length === 0 && <p className="store-offers-message">Este mercado não tem promoções válidas no momento.</p>}

      {status === "ready" && offers.length > 0 && <div className="store-offer-grid">
        {offers.map((offer) => {
          const flyerPath = offer.artifactId ? flyerImageByArtifactId[offer.artifactId] : undefined;
          return <article className="store-offer-card" key={offer.productId}>
            {flyerPath ? <a className="store-offer-image" href={publicUrl(flyerPath)} target="_blank" rel="noreferrer" aria-label={`Abrir encarte com ${offer.productName}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- vinext não expõe um componente de imagem otimizada equivalente ao next/image; usamos loading="lazy" como mitigação */}
              <img src={publicUrl(flyerPath)} alt={`Encarte da promoção: ${offer.productName}`} loading="lazy" />
              <span>Ver encarte</span>
            </a> : <div className="store-offer-placeholder" aria-label={`Imagem ainda não disponível para ${offer.productName}`}>
              <strong>{offer.brand.slice(0, 1)}</strong><span>Imagem em breve</span>
            </div>}
            <div className="store-offer-copy">
              <p>{offer.category}</p>
              <h4>{offer.productName}</h4>
              <span>{offer.brand} · {offer.measure}</span>
              <strong>{formatCurrency(offer.priceCents)}</strong>
              <small>{formatValidity(offer.expiresAt)}</small>
            </div>
          </article>;
        })}
      </div>}
    </section>
  );
}
