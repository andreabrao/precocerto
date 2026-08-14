export type NfceQrInspection =
  | {
      valid: true;
      officialUrl: string;
      accessKeySuffix?: string;
    }
  | {
      valid: false;
      message: string;
    };

const PARANA_FISCAL_HOSTS = new Set(["fazenda.pr.gov.br", "www.fazenda.pr.gov.br"]);
const NFC_E_QUERY_PATHS = new Set(["/nfce/qrcode", "/nfce/consulta"]);

/**
 * Confere apenas a URL pública gravada no QR Code da NFC-e do Paraná.
 * Não consulta a SEFA nem envia o cupom ao servidor do PreçoCerto.
 */
export function inspectParanaNfceQr(rawValue: string): NfceQrInspection {
  const value = rawValue.trim();
  if (!value) return { valid: false, message: "Cole a URL que aparece no QR Code da NFC-e." };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, message: "Este QR Code não contém uma URL de consulta válida." };
  }

  if ((url.protocol !== "https:" && url.protocol !== "http:") || !PARANA_FISCAL_HOSTS.has(url.hostname.toLowerCase())) {
    return { valid: false, message: "Use apenas um QR Code da consulta oficial da NFC-e do Paraná." };
  }

  if (!NFC_E_QUERY_PATHS.has(url.pathname.toLowerCase()) || !url.search) {
    return { valid: false, message: "A URL não corresponde ao formato público de consulta da NFC-e do Paraná." };
  }

  const payload = url.searchParams.get("p") ?? url.searchParams.get("chNFe") ?? "";
  const accessKey = payload.split("|")[0]?.replace(/\D/g, "") ?? "";
  return {
    valid: true,
    officialUrl: url.toString(),
    accessKeySuffix: accessKey.length === 44 ? accessKey.slice(-4) : undefined,
  };
}
