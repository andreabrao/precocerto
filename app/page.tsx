"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_RADIUS_KM,
  approximatePoint,
  curitibaLocalities,
  getPilotCoverageForPoint,
  resolveCuritibaLocality,
  type GeoPoint,
} from "@/lib/geo";
import { inspectParanaNfceQr, type NfceQrInspection } from "@/lib/nfce-qr";
import { apiUrl, publicUrl } from "@/lib/client-config";
import { StoreOffersPanel, type StoreOffer, type StoreOffersStatus } from "@/components/store-offers";
import { PlatformPortal } from "@/components/platform-portal";

type Category = "Essenciais" | "Limpeza" | "Bebidas" | "Hortifruti";

type Product = {
  id: string;
  name: string;
  measure: string;
  category: Category;
  price: number;
  previous: number;
  accent: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  measure: string;
  bestPriceCents?: number;
  availableStoreCount?: number;
};

type StoreResult = {
  id: string;
  name: string;
  distanceKm: number;
  totalCents: number;
  coverage: number;
  confidence: number;
  itemCount: number;
  activeOfferCount: number;
  matchedItems?: Array<{ productId: string; priceCents: number }>;
};

type ConsumerLocation = GeoPoint & {
  label: string;
  city: "Curitiba" | "Itaperuçu";
  source: "device" | "reference";
};

type RadarAlert = {
  productId: string;
  productName: string;
  ownPriceCents: number;
  competitorPriceCents: number;
  competitorStoreName: string;
  differencePercent: number;
  status: "review" | "competitive";
};

type CommunityProfile = {
  id: string;
  displayName: string;
  pointBalance: number;
  verifiedContributions: number;
  submissionCount: number;
  position?: number;
};

type CommunityNotification = {
  id: string;
  type: "verification" | "price_alert";
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type PriceAlertPreference = {
  id: string;
  productId: string;
  productName: string;
  targetCents: number;
  active: boolean;
};

type BarcodeDetection = { rawValue?: string };
type BarcodeDetectorInstance = { detect(source: ImageBitmap): Promise<BarcodeDetection[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const products: Product[] = [
  { id: "cafe-melitta-500g", name: "Café Melitta tradicional", measure: "500 g", category: "Essenciais", price: 18.99, previous: 22.49, accent: "cafe" },
  { id: "arroz-parboilizado-5kg", name: "Arroz parboilizado", measure: "5 kg", category: "Essenciais", price: 24.89, previous: 29.99, accent: "rice" },
  { id: "leite-integral-1l", name: "Leite integral", measure: "1 L", category: "Bebidas", price: 4.79, previous: 5.69, accent: "milk" },
  { id: "detergente-concentrado-500ml", name: "Detergente concentrado", measure: "500 ml", category: "Limpeza", price: 7.49, previous: 9.89, accent: "clean" },
  { id: "banana-caturra-kg", name: "Banana caturra", measure: "1 kg", category: "Hortifruti", price: 5.99, previous: 7.49, accent: "banana" },
  { id: "tomate-italiano-kg", name: "Tomate italiano", measure: "1 kg", category: "Hortifruti", price: 8.49, previous: 11.99, accent: "tomato" },
];

const fallbackCatalogProducts: CatalogProduct[] = products.map((product) => ({
  id: product.id,
  name: product.name,
  brand: "",
  category: product.category,
  measure: product.measure,
  bestPriceCents: Math.round(product.price * 100),
  availableStoreCount: 1,
}));
const accentByCategory: Record<string, string> = { Essenciais: "rice", Mercearia: "rice", Laticínios: "milk", Bebidas: "milk", Limpeza: "clean", Hortifruti: "banana", Carnes: "tomato", Perfumaria: "clean", Pet: "banana", Bazar: "clean", Padaria: "cafe", Congelados: "milk", Saudáveis: "banana", Perecíveis: "tomato" };
const visualByCategory: Record<string, string> = { Essenciais: "🛒", Mercearia: "🥫", Laticínios: "🥛", Bebidas: "🧃", Limpeza: "🫧", Hortifruti: "🍎", Carnes: "🥩", Perfumaria: "🧴", Pet: "🐾", Bazar: "🏷️", Padaria: "🥖", Congelados: "❄️", Saudáveis: "🥬", Perecíveis: "🍓" };

const fallbackStores: StoreResult[] = [
  { id: "muffato-portao", name: "Muffato Portão", distanceKm: 1.4, totalCents: 7261, coverage: 100, confidence: 100, itemCount: 3, activeOfferCount: 6 },
  { id: "condor-agua-verde", name: "Condor Água Verde", distanceKm: 2.1, totalCents: 7544, coverage: 100, confidence: 100, itemCount: 3, activeOfferCount: 6 },
  { id: "festval-batel", name: "Festval Batel", distanceKm: 2.7, totalCents: 8224, coverage: 100, confidence: 100, itemCount: 3, activeOfferCount: 6 },
];

const fallbackRadar: RadarAlert[] = [
  { productId: "cafe-melitta-500g", productName: "Café Melitta 500 g", ownPriceCents: 2249, competitorPriceCents: 1899, competitorStoreName: "Muffato Portão", differencePercent: 15.6, status: "review" },
  { productId: "arroz-parboilizado-5kg", productName: "Arroz parboilizado 5 kg", ownPriceCents: 2899, competitorPriceCents: 2489, competitorStoreName: "Muffato Portão", differencePercent: 14.1, status: "review" },
  { productId: "leite-integral-1l", productName: "Leite integral 1 L", ownPriceCents: 499, competitorPriceCents: 479, competitorStoreName: "Muffato Portão", differencePercent: 4, status: "competitive" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const toneByRank = ["lime", "blue", "orange"];
const defaultLocality = curitibaLocalities[0];
const defaultConsumerLocation: ConsumerLocation = {
  latitude: defaultLocality.latitude,
  longitude: defaultLocality.longitude,
  label: `${defaultLocality.label} — referência`,
  city: defaultLocality.city,
  source: "reference",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"consumer" | "pricing">("consumer");
  const [category, setCategory] = useState("Todos");
  const [basket, setBasket] = useState<string[]>(["cafe-melitta-500g", "arroz-parboilizado-5kg", "leite-integral-1l"]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>(fallbackCatalogProducts);
  const [productSearch, setProductSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState(0);
  const [comparisonStores, setComparisonStores] = useState<StoreResult[]>(fallbackStores);
  const [storeOffers, setStoreOffers] = useState<StoreOffer[]>([]);
  const [storeOffersState, setStoreOffersState] = useState<StoreOffersStatus>("idle");
  const [offersStore, setOffersStore] = useState<StoreResult>();
  const storeOffersRequestId = useRef(0);
  // A marcação inicial mantém o fallback útil no HTML estático. Assim que o
  // navegador faz a primeira consulta, o efeito abaixo troca para "loading"
  // e não deixa dados antigos serem exibidos durante uma mudança de região.
  const [dataState, setDataState] = useState<"loading" | "live" | "fallback">("fallback");
  const [radar, setRadar] = useState<RadarAlert[]>(fallbackRadar);
  const [radarCoverage, setRadarCoverage] = useState(86);
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [location, setLocation] = useState<ConsumerLocation>(defaultConsumerLocation);
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState<"price" | "distance">("price");
  const [contributorId, setContributorId] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : window.localStorage.getItem("precocerto-contributor-id") ?? undefined,
  );
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile>();
  const [leaderboard, setLeaderboard] = useState<CommunityProfile[]>([]);
  const [communityNotifications, setCommunityNotifications] = useState<CommunityNotification[]>([]);
  const [priceAlertPreferences, setPriceAlertPreferences] = useState<PriceAlertPreference[]>([]);
  const [communityState, setCommunityState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [displayName, setDisplayName] = useState("");
  const [contributionFile, setContributionFile] = useState<File>();
  const [contributionStoreId, setContributionStoreId] = useState("muffato-portao");
  const [contributionMarketName, setContributionMarketName] = useState("");
  const [contributionProductId, setContributionProductId] = useState("cafe-melitta-500g");
  const [contributionPrice, setContributionPrice] = useState("");
  const [contributionConsent, setContributionConsent] = useState(false);
  const [contributionMessage, setContributionMessage] = useState("");
  const [receiptQrUrl, setReceiptQrUrl] = useState("");
  const [receiptQrResult, setReceiptQrResult] = useState<NfceQrInspection>();
  const [receiptQrMessage, setReceiptQrMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const [installMessage, setInstallMessage] = useState("");
  const [showPlatformPortal, setShowPlatformPortal] = useState(false);
  const [alertProductId, setAlertProductId] = useState("cafe-melitta-500g");
  const [alertTargetPrice, setAlertTargetPrice] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const catalogWithSelectedFallbacks = useMemo(() => {
    const catalogIds = new Set(catalogProducts.map((product) => product.id));
    const missingSelectedProducts = products
      .filter((product) => basket.includes(product.id) && !catalogIds.has(product.id))
      .map((product) => ({ id: product.id, name: product.name, brand: "", category: product.category, measure: product.measure }));
    return [...catalogProducts, ...missingSelectedProducts];
  }, [basket, catalogProducts]);
  const catalogCategories = useMemo(() => ["Todos", ...[...new Set(catalogWithSelectedFallbacks.map((product) => product.category))].sort((left, right) => left.localeCompare(right, "pt-BR"))], [catalogWithSelectedFallbacks]);
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLocaleLowerCase("pt-BR");
    return catalogWithSelectedFallbacks.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const searchable = `${product.name} ${product.brand} ${product.measure}`.toLocaleLowerCase("pt-BR");
      return matchesCategory && (!search || searchable.includes(search));
    });
  }, [catalogWithSelectedFallbacks, category, productSearch]);
  const basketProducts = basket.map((productId) => catalogWithSelectedFallbacks.find((product) => product.id === productId)).filter((product): product is CatalogProduct => Boolean(product));
  const basketValue = basket.reduce((total, productId) => total + (products.find((product) => product.id === productId)?.price ?? 0), 0);
  const bestStore = comparisonStores[0] ?? fallbackStores[0];
  const activeStore = comparisonStores[selectedStore] ?? bestStore;
  const marketPricesByProduct = useMemo(() => {
    const prices = new Map<string, number>();
    for (const store of comparisonStores) {
      for (const item of store.matchedItems ?? []) {
        const currentPrice = prices.get(item.productId);
        if (currentPrice === undefined || item.priceCents < currentPrice) prices.set(item.productId, item.priceCents);
      }
    }
    return prices;
  }, [comparisonStores]);
  const matchedBasketCount = basket.filter((productId) => marketPricesByProduct.has(productId)).length;
  const matchedBasketCents = basket.reduce((total, productId) => total + (marketPricesByProduct.get(productId) ?? 0), 0);
  const completeBasketStores = basket.length > 0 ? comparisonStores.filter((store) => store.itemCount === basket.length) : [];
  const bestCompleteBasketStore = completeBasketStores[0];
  const hasCompleteLiveBasket = dataState === "live" && Boolean(bestCompleteBasketStore);
  const hasPartialLiveBasket = dataState === "live" && matchedBasketCount > 0;
  const hasNoLiveBasketCoverage = dataState === "live" && basket.length > 0 && !hasPartialLiveBasket;
  const hasNoRegionalData = dataState === "fallback" && comparisonStores.length === 0;
  const comparableAverageCents = completeBasketStores.length > 0
    ? completeBasketStores.reduce((sum, store) => sum + store.totalCents, 0) / completeBasketStores.length
    : 0;
  const coverageProgress = dataState === "loading"
    ? 34
    : dataState === "live"
      ? (basket.length === 0 ? 0 : Math.min(100, (matchedBasketCount / basket.length) * 100))
      : Math.min(100, 38 + basket.length * 14);
  const unreadAlerts = communityNotifications.filter((notification) => !notification.readAt).length;
  const contributionStoreOptions = location.city === "Itaperuçu"
    ? [{ id: "community-itaperucu", name: "Outro mercado em Itaperuçu" }]
    : [...fallbackStores.map((store) => ({ id: store.id, name: store.name })), { id: "community-curitiba", name: "Outro mercado em Curitiba" }];
  const activeContributionStoreId = location.city === "Itaperuçu" ? "community-itaperucu" : contributionStoreId;
  const contributionNeedsMarketName = activeContributionStoreId.startsWith("community-");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      basket: basket.join(","),
      lat: String(location.latitude),
      lng: String(location.longitude),
      radiusKm: String(radiusKm),
      sort: sortBy,
    });
    // Não deixe resultados da cidade anterior visíveis enquanto a nova
    // consulta é processada. Isso evita que Curitiba apareça em Itaperuçu
    // por alguns segundos após uma troca de localização.
    setDataState("loading");
    setComparisonStores([]);
    setSelectedStore(0);
    storeOffersRequestId.current += 1;
    setStoreOffers([]);
    setOffersStore(undefined);
    setStoreOffersState("idle");

    fetch(apiUrl(`/api/comparison?${query.toString()}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("comparison unavailable");
        const payload = (await response.json()) as { stores?: StoreResult[] };
        if (!Array.isArray(payload.stores)) throw new Error("invalid comparison");
        setComparisonStores(payload.stores);
        setSelectedStore(0);
        storeOffersRequestId.current += 1;
        setStoreOffers([]);
        setOffersStore(undefined);
        setStoreOffersState("idle");
        setDataState("live");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // O fallback contém apenas preços de demonstração de Curitiba. Nunca
        // o reutilize para outra cidade, pois seria uma comparação incorreta.
        setComparisonStores(location.city === "Curitiba" ? fallbackStores : []);
        storeOffersRequestId.current += 1;
        setOffersStore(undefined);
        setStoreOffersState("idle");
        setDataState("fallback");
    });
    return () => controller.abort();
  }, [basket, location, radiusKm, sortBy]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude), radiusKm: String(radiusKm) });
    setCatalogProducts([]);
    fetch(apiUrl(`/api/catalog?${query.toString()}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        const payload = (await response.json()) as { products?: CatalogProduct[] };
        if (!Array.isArray(payload.products)) throw new Error("invalid catalog");
        setCatalogProducts(payload.products);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogProducts(location.city === "Curitiba" ? fallbackCatalogProducts : []);
      });
    return () => controller.abort();
  }, [location, radiusKm]);

  useEffect(() => {
    if (activeTab !== "pricing") return;
    const controller = new AbortController();
    fetch(apiUrl("/api/pricing/radar?store=festval-batel"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("radar unavailable");
        const payload = (await response.json()) as { alerts?: RadarAlert[]; coveragePercentage?: number };
        if (payload.alerts?.length) setRadar(payload.alerts);
        if (typeof payload.coveragePercentage === "number") setRadarCoverage(payload.coveragePercentage);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeTab]);

  const refreshCommunity = useCallback(async (id?: string) => {
    try {
      const response = await fetch(apiUrl(id ? `/api/community/summary?contributorId=${encodeURIComponent(id)}` : "/api/community/leaderboard"));
      if (!response.ok) throw new Error("community unavailable");
      const payload = (await response.json()) as {
        profile?: CommunityProfile;
        leaderboard?: CommunityProfile[];
        notifications?: CommunityNotification[];
        preferences?: PriceAlertPreference[];
      };
      setCommunityProfile(payload.profile);
      setLeaderboard(payload.leaderboard ?? []);
      setCommunityNotifications(payload.notifications ?? []);
      setPriceAlertPreferences(payload.preferences ?? []);
      setCommunityState("ready");
    } catch {
      setCommunityState("error");
    }
  }, []);

  useEffect(() => {
    const portalTimer = window.setTimeout(() => {
      if (window.localStorage.getItem("precocerto-platform-landing-seen") !== "true") setShowPlatformPortal(true);
    }, 0);
    return () => window.clearTimeout(portalTimer);
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshCommunity(contributorId), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [contributorId, refreshCommunity]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(publicUrl("service-worker.js"), { scope: publicUrl() }).catch(() => undefined);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(undefined);
      setInstallMessage("PreçoCerto instalado neste dispositivo.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const toggleBasket = (id: string) => {
    setBasket((current) => current.includes(id) ? current.filter((productId) => productId !== id) : [...current, id]);
  };

  const useDeviceLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationMessage("Seu navegador não oferece localização. Escolha um bairro de referência.");
      return;
    }
    setLocationMessage("Buscando sua localização aproximada...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = approximatePoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const coverage = getPilotCoverageForPoint(point);
        if (!coverage) {
          setLocationMessage("A cobertura piloto atende Curitiba e Itaperuçu. Escolha uma região da lista.");
          return;
        }
        setLocation({ ...point, city: coverage.city, label: `Sua localização aproximada — ${coverage.city}`, source: "device" });
        setLocationMessage("Localização aplicada somente a esta comparação.");
        setLocationPanelOpen(false);
      },
      () => setLocationMessage("Não foi possível usar a localização. Escolha um bairro de referência."),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
    );
  };

  const useReferenceLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const locality = resolveCuritibaLocality(locationInput);
    if (!locality) {
      setLocationMessage("Use um bairro listado ou um dos CEPs de referência do piloto.");
      return;
    }
    setLocation({ ...locality, label: `${locality.label} — referência`, city: locality.city, source: "reference" });
    setLocationMessage("Bairro de referência aplicado. Nenhuma localização do dispositivo foi usada.");
    setLocationPanelOpen(false);
  };

  const joinCommunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContributionMessage("");
    try {
      const response = await fetch(apiUrl("/api/community/contributors"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const payload = (await response.json()) as { profile?: CommunityProfile; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? "Não foi possível entrar.");
      window.localStorage.setItem("precocerto-contributor-id", payload.profile.id);
      setContributorId(payload.profile.id);
      setCommunityProfile(payload.profile);
      setContributionMessage("Perfil criado. Sua primeira etiqueta pode render pontos após validação.");
    } catch (error) {
      setContributionMessage(error instanceof Error ? error.message : "Não foi possível entrar na comunidade.");
    }
  };

  const inspectReceiptQr = (value: string) => {
    setReceiptQrUrl(value);
    const result = inspectParanaNfceQr(value);
    setReceiptQrResult(result);
    setReceiptQrMessage(result.valid
      ? `QR Code oficial reconhecido${result.accessKeySuffix ? ` · chave terminada em ${result.accessKeySuffix}` : ""}.`
      : result.message);
  };

  const installApplication = async () => {
    if (!installPrompt) {
      setInstallMessage("No celular, abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(undefined);
    setInstallMessage(choice.outcome === "accepted" ? "Instalação iniciada." : "Instalação cancelada. Você pode instalar quando quiser.");
  };

  const scanReceiptQrImage = async (file?: File) => {
    if (!file) return;
    const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!detector || typeof window.createImageBitmap !== "function") {
      setReceiptQrMessage("Este navegador não consegue ler QR por imagem. Cole abaixo a URL exibida no QR Code da nota.");
      return;
    }

    setReceiptQrMessage("Lendo o QR Code no seu dispositivo...");
    try {
      const bitmap = await window.createImageBitmap(file);
      try {
        const codes = await new detector({ formats: ["qr_code"] }).detect(bitmap);
        const value = codes[0]?.rawValue;
        if (!value) {
          setReceiptQrResult(undefined);
          setReceiptQrMessage("Não encontramos um QR Code nessa imagem. Tente uma foto mais nítida ou cole a URL.");
          return;
        }
        inspectReceiptQr(value);
      } finally {
        bitmap.close();
      }
    } catch {
      setReceiptQrResult(undefined);
      setReceiptQrMessage("Não foi possível ler essa imagem. Tente novamente ou cole a URL da nota.");
    }
  };

  const submitContribution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contributorId || !contributionFile) {
      setContributionMessage("Crie seu perfil e selecione uma foto da etiqueta.");
      return;
    }
    if (location.source !== "device") {
      setContributionMessage("Use sua localização aproximada para enviar uma etiqueta. Ela não fica salva como histórico.");
      return;
    }
    if (!contributionConsent) {
      setContributionMessage("Confirme o uso da localização aproximada para esta contribuição.");
      return;
    }
    if (contributionNeedsMarketName && contributionMarketName.trim().length < 3) {
      setContributionMessage("Informe o nome do mercado fotografado.");
      return;
    }
    const priceCents = Math.round(Number(contributionPrice.replace(",", ".")) * 100);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      setContributionMessage("Informe o preço da etiqueta, por exemplo 18,99.");
      return;
    }
    setContributionMessage("Enviando sua etiqueta...");
    const form = new FormData();
    form.append("contributorId", contributorId);
    form.append("storeId", activeContributionStoreId);
    form.append("marketName", contributionMarketName.trim());
    form.append("productId", contributionProductId);
    form.append("priceCents", String(priceCents));
    form.append("latitude", String(location.latitude));
    form.append("longitude", String(location.longitude));
    form.append("locationConsent", "true");
    form.append("photo", contributionFile);
    try {
      const response = await fetch(apiUrl("/api/community/contributions"), { method: "POST", body: form });
      const payload = (await response.json()) as { contribution?: { status: string; pointsAwarded: number; awaiting?: string }; error?: string };
      if (!response.ok || !payload.contribution) throw new Error(payload.error ?? "Não foi possível enviar a etiqueta.");
      setContributionFile(undefined);
      setContributionPrice("");
      setContributionConsent(false);
      setContributionMessage(payload.contribution.status === "verified" ? `Etiqueta validada: +${payload.contribution.pointsAwarded} pontos.` : payload.contribution.awaiting ?? "Etiqueta recebida para validação.");
      await refreshCommunity(contributorId);
    } catch (error) {
      setContributionMessage(error instanceof Error ? error.message : "Não foi possível enviar a etiqueta.");
    }
  };

  const savePriceAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contributorId) return;
    const targetCents = Math.round(Number(alertTargetPrice.replace(",", ".")) * 100);
    if (!Number.isInteger(targetCents) || targetCents <= 0) {
      setAlertMessage("Informe um preço-alvo válido.");
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/community/alerts/preferences"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contributorId, productId: alertProductId, targetCents }),
      });
      if (!response.ok) throw new Error("Não foi possível ativar o alerta.");
      setAlertTargetPrice("");
      setAlertMessage("Alerta ativo. Você verá o aviso assim que um preço válido atingir sua meta.");
      await refreshCommunity(contributorId);
    } catch (error) {
      setAlertMessage(error instanceof Error ? error.message : "Não foi possível ativar o alerta.");
    }
  };

  const markAlertsRead = async () => {
    if (!contributorId) return;
    await fetch(apiUrl("/api/community/alerts/read"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contributorId }),
    });
    await refreshCommunity(contributorId);
  };

  const showStoreOffers = async (store: StoreResult, index: number) => {
    const requestId = ++storeOffersRequestId.current;
    setSelectedStore(index);
    setOffersStore(store);
    setStoreOffers([]);
    setStoreOffersState("loading");
    try {
      const response = await fetch(apiUrl(`/api/store-offers?store=${encodeURIComponent(store.id)}`));
      const payload = (await response.json()) as { offers?: StoreOffer[]; error?: string };
      if (!response.ok || !Array.isArray(payload.offers)) throw new Error(payload.error ?? "Não foi possível carregar as promoções.");
      if (requestId !== storeOffersRequestId.current) return;
      setStoreOffers(payload.offers);
      setStoreOffersState("ready");
    } catch {
      if (requestId !== storeOffersRequestId.current) return;
      setStoreOffersState("error");
    }
  };

  const closeStoreOffers = () => {
    storeOffersRequestId.current += 1;
    setStoreOffersState("idle");
    setOffersStore(undefined);
  };

  const sendFeedback = async () => {
    const product = basketProducts[0] ?? products[0];
    setFeedbackState("sending");
    try {
      const response = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId: activeStore.id, productId: product.id, reason: "Preço diferente na loja" }),
      });
      setFeedbackState(response.ok ? "sent" : "error");
    } catch {
      setFeedbackState("error");
    }
  };

  const exportRadar = () => {
    const rows = [
      ["SKU", "Seu preço", "Menor concorrente", "Concorrente", "Diferença (%)", "Status"],
      ...radar.map((alert) => [alert.productName, (alert.ownPriceCents / 100).toFixed(2), (alert.competitorPriceCents / 100).toFixed(2), alert.competitorStoreName, alert.differencePercent.toFixed(1), alert.status]),
    ];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${value}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "radar-precos-curitiba.csv";
    link.click();
    URL.revokeObjectURL(href);
  };

  if (showPlatformPortal) return <PlatformPortal onOpenShopping={() => setShowPlatformPortal(false)} onClose={() => setShowPlatformPortal(false)} />;

  return (
    <main>
      <div className="announcement"><span className="pulse" aria-hidden="true" />Cobertura piloto: Curitiba e Itaperuçu, Paraná <span className="announcement-separator">•</span><strong>{dataState === "live" ? "base local sincronizada" : "preços de demonstração"}</strong></div>

      <nav className="topbar" aria-label="Navegação principal">
        <a className="brand" href="#inicio" aria-label="PreçoCerto, início"><span className="brand-mark">p</span><span>preçocerto</span></a>
        <div className="nav-links"><a href="#ofertas">Ofertas</a><a href="#cesta">Minha cesta</a><a href="#mercados">Mercados</a><a href="#comunidade">Comunidade</a></div>
        <div className="topbar-actions"><button className="account-button" aria-label="Minha conta" onClick={() => setShowPlatformPortal(true)}>Minha conta</button><button className="install-app-button" onClick={() => void installApplication()}>Instalar app</button><button className="basket-button" onClick={() => document.getElementById("cesta")?.scrollIntoView({ behavior: "smooth" })}><span aria-hidden="true">⌑</span> Cesta <b>{basket.length}</b></button></div>
      </nav>
      {installMessage && <p className="pwa-status" role="status">{installMessage}</p>}

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">MERCADOS PERTO DE VOCÊ</p>
          <h1>Sua compra rende mais<br /><em>perto de você.</em></h1>
          <p className="hero-description">Compare sua cesta dentro do seu raio, encontre ofertas e escolha com confiança.</p>
          <div className="location-card"><span className="location-dot" aria-hidden="true">⌖</span><div><small>Sua região</small><strong>{location.label}</strong></div><button aria-expanded={locationPanelOpen} onClick={() => setLocationPanelOpen((open) => !open)} aria-label="Alterar região">Alterar</button></div>
          {locationPanelOpen && <div className="location-panel">
            <div><strong>Compare perto de você</strong><p>Usamos uma localização aproximada apenas nesta consulta. Ela não fica salva.</p></div>
            <button className="location-primary" onClick={useDeviceLocation}>Usar minha localização</button>
            <form className="location-form" onSubmit={useReferenceLocation}>
              <label htmlFor="location-reference">Ou use bairro/cidade de referência</label>
              <div><input id="location-reference" list="curitiba-localities" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder="Ex.: Água Verde ou Itaperuçu" /><button>Aplicar</button></div>
              <datalist id="curitiba-localities">{curitibaLocalities.map((locality) => <option value={locality.label} key={locality.id} />)}</datalist>
            </form>
            {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
          </div>}
          <div className="trust-line"><span className="verified-icon" aria-hidden="true">✓</span>{location.source === "device" ? "Localização aproximada, sem histórico salvo." : "Escolha sua localização ou um bairro de referência."}</div>
        </div>
          <div className="hero-card" aria-label="Resumo de economia da sua cesta">
          <div className="hero-harvest" aria-hidden="true"><span className="harvest-leaf">🥬</span><span className="harvest-fruit">🍊</span><span className="harvest-apple">🍎</span><span className="harvest-basket">🧺</span></div>
          <div className="hero-card-top"><div><span className="mini-label">{dataState === "loading" ? "ATUALIZANDO A REGIÃO" : hasNoRegionalData ? "DADOS INDISPONÍVEIS" : hasCompleteLiveBasket ? "MELHOR CESTA LOCAL" : hasPartialLiveBasket ? "COBERTURA DA CESTA" : hasNoLiveBasketCoverage ? "SEM COBERTURA PARA A CESTA" : "SUA ECONOMIA HOJE"}</span><strong>{dataState === "loading" || hasNoLiveBasketCoverage || hasNoRegionalData ? "—" : hasCompleteLiveBasket ? formatCurrency(bestCompleteBasketStore!.totalCents / 100) : hasPartialLiveBasket ? `${matchedBasketCount} de ${basket.length}` : formatCurrency(basketValue)}</strong></div><span className="hero-sparkle" aria-hidden="true">✦</span></div>
          <p>{dataState === "loading" ? `Buscando preços em ${location.city}` : hasNoRegionalData ? `Não foi possível atualizar os preços em ${location.city}` : hasCompleteLiveBasket ? "Todos os itens com preço atual" : hasPartialLiveBasket ? "Itens com preço atual na sua região" : hasNoLiveBasketCoverage ? "Troque os itens da cesta por ofertas locais para comparar" : "Na sua cesta selecionada"}</p><div className="card-progress"><span style={{ width: `${coverageProgress}%` }} /></div>
          {dataState === "loading" ? <div className="price-comparison"><div><small>status</small><b>sincronizando</b></div></div> : hasNoRegionalData ? <div className="price-comparison"><div><small>próximo passo</small><b>tente novamente em instantes</b></div></div> : hasCompleteLiveBasket ? <div className="price-comparison"><div><small>menor cesta</small><b>{formatCurrency(bestCompleteBasketStore!.totalCents / 100)}</b></div><span>vs.</span><div><small>média local</small><b>{formatCurrency(comparableAverageCents / 100)}</b></div></div> : hasPartialLiveBasket ? <div className="price-comparison"><div><small>itens localizados</small><b>{formatCurrency(matchedBasketCents / 100)}</b></div><span>•</span><div><small>situação</small><b>cesta parcial</b></div></div> : hasNoLiveBasketCoverage ? <div className="price-comparison"><div><small>próximo passo</small><b>adicione ofertas locais</b></div></div> : <div className="price-comparison"><div><small>menor cesta</small><b>{formatCurrency(bestStore.totalCents / 100)}</b></div><span>vs.</span><div><small>média local</small><b>{formatCurrency(comparisonStores.reduce((sum, store) => sum + store.totalCents, 0) / Math.max(comparisonStores.length, 1) / 100)}</b></div></div>}
        </div>
      </section>

      <section className="workspace" aria-label="Painel de comparação">
        <div className="workspace-head"><div className="tabs" role="tablist" aria-label="Modo de visualização"><button className={activeTab === "consumer" ? "tab active" : "tab"} onClick={() => setActiveTab("consumer")} role="tab" aria-selected={activeTab === "consumer"}>Para sua compra</button><button className={activeTab === "pricing" ? "tab active" : "tab"} onClick={() => setActiveTab("pricing")} role="tab" aria-selected={activeTab === "pricing"}>Inteligência de preços</button></div><span className={dataState === "live" ? "refresh-status data-live" : "refresh-status"}><span aria-hidden="true">↻</span>{dataState === "loading" ? " Sincronizando..." : dataState === "live" ? " Dados e validade atualizados" : " Modo demonstrativo"}</span></div>

        {activeTab === "consumer" ? (
          <div className="consumer-grid">
            <section className="basket-panel" id="cesta">
              <div className="section-heading"><div><p className="eyebrow">COMPARADOR</p><h2>Monte sua cesta</h2></div><span className="item-count">{basket.length} itens</span></div>
              <div className="filters" aria-label="Categorias de produtos">{catalogCategories.map((item) => <button key={item} className={category === item ? "filter selected" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}</div>
              <label className="product-search"><span className="sr-only">Buscar produto no catálogo</span><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={`Buscar entre ${catalogWithSelectedFallbacks.length} produtos cadastrados`} /></label>
              <div className="product-list">{filteredProducts.map((product) => {
                const selected = basket.includes(product.id);
                const livePriceCents = marketPricesByProduct.get(product.id) ?? product.bestPriceCents;
                const fallbackProduct = products.find((candidate) => candidate.id === product.id);
                const visiblePrice = dataState === "live" ? (livePriceCents === undefined ? undefined : livePriceCents / 100) : dataState === "loading" ? undefined : fallbackProduct?.price;
                const availability = dataState === "live" ? product.availableStoreCount && product.availableStoreCount > 1 ? `comparado em ${product.availableStoreCount} mercados` : "oferta em 1 mercado" : dataState === "loading" ? "Atualizando pela sua região" : fallbackProduct ? `${Math.max(0, Math.round((1 - fallbackProduct.price / fallbackProduct.previous) * 100))}% menor` : "preço de referência";
                return <article className="product-row" key={product.id}><div className={`product-art ${accentByCategory[product.category] ?? "cafe"}`} aria-hidden="true"><span>{visualByCategory[product.category] ?? "🛒"}</span></div><div className="product-copy"><strong>{product.name}</strong><span>{product.brand ? `${product.brand} · ` : ""}{product.measure}</span></div><div className="product-price">{visiblePrice === undefined ? <><b>Sem preço local</b><span>{dataState === "loading" ? availability : "Aguardando oferta"}</span></> : <><b>{formatCurrency(visiblePrice)}</b><span>{availability}</span></>}</div><button className={selected ? "add-button added" : "add-button"} onClick={() => toggleBasket(product.id)} aria-pressed={selected}>{selected ? "✓" : "+"}<span className="sr-only">{selected ? "Remover da" : "Adicionar à"} cesta</span></button></article>;
              })}</div>
              <div className="basket-total"><span>{dataState === "loading" ? "Atualizando os preços da cesta" : hasNoRegionalData ? "Dados locais indisponíveis agora" : hasCompleteLiveBasket ? "Total da melhor combinação local" : hasPartialLiveBasket ? `Preços localizados em ${matchedBasketCount} de ${basket.length} itens` : dataState === "live" ? "Nenhum preço atual encontrado" : "Total estimado na melhor combinação"}</span><strong>{dataState === "loading" || hasNoRegionalData ? "—" : hasPartialLiveBasket ? formatCurrency(matchedBasketCents / 100) : dataState === "live" ? "—" : formatCurrency(basketValue)}</strong></div>
            </section>

            <aside className="stores-panel" id="mercados">
              <div className="section-heading"><div><p className="eyebrow">RESULTADO</p><h2>Onde vale mais</h2></div><span className="map-label">{location.city} · {radiusKm} KM</span></div>
              <div className="search-controls" aria-label="Preferências de comparação"><label>Raio<select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>{[3, 5, 8, 12, 15].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}</select></label><label>Priorizar<select value={sortBy} onChange={(event) => setSortBy(event.target.value as "price" | "distance")}><option value="price">Menor preço</option><option value="distance">Mais perto</option></select></label></div>
              <div className="map-surface" aria-label="Mapa ilustrativo dos mercados monitorados no raio selecionado"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-pin pin-one">1</span><span className="map-pin pin-two">2</span><span className="map-pin pin-three">3</span><span className="map-you">você</span></div>
              {dataState === "loading" ? <p className="comparison-loading" role="status">Atualizando mercados e preços para {location.city}…</p> : comparisonStores.length > 0 ? <><div className="store-list">{comparisonStores.map((store, index) => <button className={selectedStore === index ? "store-card selected" : "store-card"} key={store.id} onClick={() => void showStoreOffers(store, index)}><span className={`rank ${toneByRank[index] ?? "orange"}`}>{index + 1}</span><span className="store-info"><b>{store.name}</b><small>{store.itemCount > 0 ? `${store.itemCount} de ${basketProducts.length} itens · ${store.distanceKm.toFixed(1).replace(".", ",")} km de você` : `${store.activeOfferCount} ofertas oficiais ativas · ${store.distanceKm.toFixed(1).replace(".", ",")} km de você`}</small></span><span className="store-total"><small>{store.itemCount === basketProducts.length ? index === 0 && sortBy === "price" ? "Melhor cesta" : "Cesta completa" : store.itemCount > 0 ? "Cesta parcial" : "Ofertas ativas"}</small><b>{store.itemCount > 0 ? formatCurrency(store.totalCents / 100) : `${store.activeOfferCount} ofertas`}</b></span></button>)}</div>
              <button className="primary-cta" onClick={() => void showStoreOffers(activeStore, selectedStore)}>{activeStore.itemCount > 0 ? `Ver itens encontrados em ${activeStore.name}` : `Ver ofertas em ${activeStore.name}`} <span aria-hidden="true">→</span></button>
              <StoreOffersPanel store={offersStore} offers={storeOffers} status={storeOffersState} onClose={closeStoreOffers} />
              <button className="secondary-action" onClick={sendFeedback} disabled={feedbackState === "sending" || feedbackState === "sent"}>{feedbackState === "sent" ? "Obrigado por avisar" : feedbackState === "error" ? "Tentar reportar novamente" : "Encontrou preço diferente?"}</button></> : <p className="empty-results">{hasNoRegionalData ? `Não foi possível atualizar os mercados de ${location.city} agora. Tente novamente em instantes.` : `Ainda não há mercados com preços validados neste raio em ${location.city}. Envie uma etiqueta para ajudar a abrir essa cobertura.`}</p>}
            </aside>
          </div>
        ) : (
          <section className="pricing-panel">
            <div className="pricing-intro"><div><p className="eyebrow">SAAS B2B</p><h2>Radar de preço em Curitiba</h2><p>Uma visão operacional para acompanhar concorrentes, detectar variações e priorizar revisão de ofertas.</p></div><button className="outline-button" onClick={exportRadar}>Exportar leitura semanal</button></div>
            <div className="metric-strip"><div><span>Índice da cesta</span><strong>94,2</strong><small className="positive">↓ 2,8 pts na semana</small></div><div><span>SKUs monitorados</span><strong>{products.length}</strong><small>em 4 categorias</small></div><div><span>Alertas relevantes</span><strong>{radar.filter((alert) => alert.status === "review").length}</strong><small className="warning">priorize os maiores desvios</small></div><div><span>Cobertura recente</span><strong>{radarCoverage}%</strong><small>com validade ativa</small></div></div>
            <div className="pricing-table"><div className="pricing-row pricing-header"><span>SKU prioritário</span><span>Seu preço</span><span>Menor concorrente</span><span>Movimento</span><span>Status</span></div>{radar.slice(0, 4).map((alert) => <div className="pricing-row" key={alert.productId}><strong>{alert.productName}</strong><b>{formatCurrency(alert.ownPriceCents / 100)}</b><b>{formatCurrency(alert.competitorPriceCents / 100)}</b><span className={alert.status === "review" ? "down" : "flat"}>{alert.status === "review" ? `↓ ${alert.differencePercent.toFixed(1)}%` : "— competitivo"}</span><em className={alert.status === "review" ? "tag action" : "tag okay"}>{alert.status === "review" ? "Revisar" : "Competitivo"}</em></div>)}</div>
          </section>
        )}
      </section>

      <section className="offers" id="ofertas"><div className="offers-copy"><p className="eyebrow">OFERTAS DA SEMANA</p><h2>Não é só preço.<br />É timing.</h2><p>Receba avisos quando o item que você procura estiver no melhor momento para comprar.</p><button className="text-link" onClick={() => { setCategory("Hortifruti"); document.getElementById("cesta")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Explorar ofertas perto de você <span aria-hidden="true">→</span></button></div><div className="offer-cards"><article className="offer-card orange-card"><span>HORTIFRUTI</span><strong>Até 28% menor</strong><p>Ofertas frescas para a semana.</p><i aria-hidden="true">🥬</i></article><article className="offer-card navy-card"><span>CAFÉ &amp; DESPENSA</span><strong>Cesta em queda</strong><p>{dataState === "live" ? "Preços vindos da base local." : "Conecte fontes autorizadas para ativar."}</p><i aria-hidden="true">🧺</i></article></div></section>

      <section className="community" id="comunidade" aria-label="Comunidade de preços">
        <div className="community-heading"><div><p className="eyebrow">COMUNIDADE PREÇOCERTO</p><h2>Viu uma oferta? <em>Fortaleça o mapa.</em></h2><p>Envie uma foto da etiqueta, com localização aproximada e sem histórico. Duas contribuições compatíveis validam o preço e liberam pontos.</p></div><div className="community-badge"><span aria-hidden="true">✦</span><strong>{communityProfile ? `${communityProfile.pointBalance} pontos` : "15 pontos"}</strong><small>por etiqueta validada</small></div></div>

        {!communityProfile ? <div className="community-start">
          <div><strong>Participe com um apelido</strong><p>Seu perfil serve para registrar pontos e ranking neste dispositivo. Para uma versão pública, a conta deve evoluir para login seguro.</p></div>
          <form className="community-join" onSubmit={joinCommunity}><label htmlFor="display-name">Como quer aparecer?</label><div><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex.: Ana do Batel" maxLength={28} required /><button>Entrar na comunidade</button></div></form>
          {contributionMessage && <p className="community-message" role="status">{contributionMessage}</p>}
          <div className="leaderboard-preview"><span>Ranking de Curitiba</span>{leaderboard.length > 0 ? leaderboard.slice(0, 3).map((entry) => <div key={entry.id}><b>#{entry.position} {entry.displayName}</b><small>{entry.pointBalance} pts</small></div>) : <small>{communityState === "loading" ? "Carregando comunidade..." : "Seja a primeira pessoa no ranking."}</small>}</div>
        </div> : <div className="community-grid">
          <article className="community-profile-card"><div className="profile-top"><span className="profile-avatar">{communityProfile.displayName.slice(0, 1).toUpperCase()}</span><div><small>SEU PERFIL</small><strong>{communityProfile.displayName}</strong></div><span className="profile-position">#{communityProfile.position}</span></div><div className="profile-score"><strong>{communityProfile.pointBalance}</strong><span>pontos</span></div><div className="profile-stats"><span><b>{communityProfile.verifiedContributions}</b> etiquetas validadas</span><span><b>{communityProfile.submissionCount}</b> envios</span></div><p>Contribuições pendentes não geram pontos até outra pessoa confirmar o mesmo preço.</p></article>

          <article className="contribution-card"><div><p className="eyebrow">COLABORE</p><h3>Envie uma etiqueta</h3><p>Foto, preço, mercado e localização aproximada. JPG, PNG ou WebP de até 5 MB.</p></div><form className="contribution-form" onSubmit={submitContribution}><div className="form-row"><label>Mercado<select value={activeContributionStoreId} onChange={(event) => setContributionStoreId(event.target.value)}>{contributionStoreOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Produto<select value={contributionProductId} onChange={(event) => setContributionProductId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.measure}</option>)}</select></label></div>{contributionNeedsMarketName && <label>Nome do mercado fotografado<input value={contributionMarketName} onChange={(event) => setContributionMarketName(event.target.value)} placeholder={location.city === "Itaperuçu" ? "Ex.: nome do mercado em Itaperuçu" : "Ex.: nome do mercado"} maxLength={80} required /></label>}<div className="form-row"><label>Preço da etiqueta<input inputMode="decimal" value={contributionPrice} onChange={(event) => setContributionPrice(event.target.value)} placeholder="Ex.: 18,99" required /></label><label>Foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setContributionFile(event.target.files?.[0])} required /></label></div><div className={location.source === "device" ? "geo-ready" : "geo-required"}><span>{location.source === "device" ? `✓ Localização aproximada pronta em ${location.city}` : "⌖ Localização necessária para validar a loja"}</span><button type="button" onClick={useDeviceLocation}>{location.source === "device" ? "Atualizar" : "Usar minha localização"}</button></div><label className="consent-row"><input type="checkbox" checked={contributionConsent} onChange={(event) => setContributionConsent(event.target.checked)} /> Concordo com o uso da minha localização aproximada somente para validar esta etiqueta.</label><button className="contribution-submit">Enviar para validação <span aria-hidden="true">→</span></button></form>{contributionMessage && <p className="community-message" role="status">{contributionMessage}</p>}</article>

          <article className="leaderboard-card"><div className="leaderboard-title"><div><p className="eyebrow">RANKING</p><h3>Quem fortalece a região</h3></div><span>{leaderboard.length} pessoas</span></div><div className="leaderboard-list">{leaderboard.length > 0 ? leaderboard.map((entry) => <div className={entry.id === contributorId ? "leaderboard-row current" : "leaderboard-row"} key={entry.id}><b>#{entry.position}</b><span>{entry.displayName}</span><small>{entry.pointBalance} pts</small></div>) : <p>O ranking aparecerá com as primeiras contribuições validadas.</p>}</div></article>
        </div>}

        {communityProfile && <div className="community-lower-grid"><article className="target-alert-card"><div><p className="eyebrow">ALERTAS ANTECIPADOS</p><h3>Avise quando chegar no seu preço</h3><p>Os alertas aparecem aqui assim que uma fonte válida registrar o valor desejado.</p></div><form className="alert-form" onSubmit={savePriceAlert}><select value={alertProductId} onChange={(event) => setAlertProductId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input inputMode="decimal" value={alertTargetPrice} onChange={(event) => setAlertTargetPrice(event.target.value)} placeholder="Preço-alvo, ex.: 17,99" required /><button>Ativar alerta</button></form>{priceAlertPreferences.length > 0 && <div className="preference-list">{priceAlertPreferences.map((preference) => <span key={preference.id}>{preference.productName}: até {formatCurrency(preference.targetCents / 100)}</span>)}</div>}{alertMessage && <p className="community-message" role="status">{alertMessage}</p>}</article><article className="notifications-card"><div className="notifications-title"><div><p className="eyebrow">SEUS AVISOS</p><h3>{unreadAlerts > 0 ? `${unreadAlerts} novo${unreadAlerts > 1 ? "s" : ""}` : "Tudo em dia"}</h3></div>{unreadAlerts > 0 && <button onClick={markAlertsRead}>Marcar como lidos</button>}</div><div className="notification-list">{communityNotifications.length > 0 ? communityNotifications.map((notification) => <div className={notification.readAt ? "notification read" : "notification"} key={notification.id}><strong>{notification.title}</strong><span>{notification.body}</span></div>) : <p>Ative um alerta ou envie uma etiqueta para receber avisos aqui.</p>}</div></article></div>}
      </section>

      <section className="receipt-check" aria-label="Leitor de QR Code da NFC-e">
        <div><p className="eyebrow">NOTA FISCAL</p><h2>Confira o QR Code da sua compra.</h2><p>Leia uma NFC-e do Paraná no próprio aparelho. A URL não é enviada nem pesquisada automaticamente pelo PreçoCerto.</p></div>
        <div className="receipt-check-form">
          <label>Imagem do QR Code<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void scanReceiptQrImage(event.target.files?.[0])} /></label>
          <label>Ou cole a URL da nota<input inputMode="url" value={receiptQrUrl} onChange={(event) => inspectReceiptQr(event.target.value)} placeholder="https://www.fazenda.pr.gov.br/nfce/..." /></label>
          {receiptQrMessage && <p className={receiptQrResult?.valid ? "qr-message valid" : "qr-message"} role="status">{receiptQrMessage}</p>}
          {receiptQrResult?.valid && <a className="official-receipt-link" href={receiptQrResult.officialUrl} target="_blank" rel="noreferrer">Abrir consulta oficial da NFC-e <span aria-hidden="true">↗</span></a>}
          <small>Não tentamos superar CAPTCHA nem extrair dados do portal. Use esta confirmação junto da foto da etiqueta ao participar da comunidade.</small>
        </div>
      </section>

      <footer><a className="brand footer-brand" href="#inicio"><span className="brand-mark">p</span><span>preçocerto</span></a><p>Comparação inteligente para compras locais.</p><span>Cobertura piloto: Curitiba e Itaperuçu, PR</span></footer>
    </main>
  );
}
