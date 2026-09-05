// ==================== Cloudflare colo → country lookup ====================
//
// `/cdn-cgi/trace` (used by clean-ips.ts to test a candidate IP) always
// includes a `colo=` line naming the three-letter IATA-style airport code of
// the Cloudflare data center that actually answered the request. Since we
// dial each candidate IP directly (via `cf.resolveOverride`), the colo we
// get back tells us where THAT SPECIFIC IP's edge node lives — which is what
// lets the admin panel group/label discovered clean IPs by country the same
// way the Z-E-U-S scanner's per-country proxy lists do, without needing any
// external GeoIP API call (which would cost an extra subrequest per test and
// isn't guaranteed to agree with Cloudflare's own routing anyway).
//
// This list covers Cloudflare's publicly documented data center locations
// (https://www.cloudflare.com/network/). It isn't guaranteed to be
// exhaustive forever — Cloudflare adds new colos over time — so an unknown
// code degrades gracefully to a null/"unknown" country rather than throwing.
export const COLO_COUNTRY: Record<string, string> = {
  // Middle East / nearby (most relevant for Iran-based users)
  DXB: 'AE', SHJ: 'AE', AUH: 'AE', DOH: 'QA', BAH: 'BH', KWI: 'KW',
  RUH: 'SA', JED: 'SA', DMM: 'SA', AMM: 'JO', BEY: 'LB', TLV: 'IL',
  IST: 'TR', ESB: 'TR', ADB: 'TR', BUS: 'GE', EVN: 'AM', GYD: 'AZ',
  TAS: 'UZ', ALA: 'KZ', KBL: 'AF', ISB: 'PK', KHI: 'PK', LHE: 'PK',
  MCT: 'OM',

  // Europe
  LHR: 'GB', MAN: 'GB', LON: 'GB', DUB: 'IE', AMS: 'NL', RTM: 'NL',
  FRA: 'DE', DUS: 'DE', MUC: 'DE', BER: 'DE', HAM: 'DE', TXL: 'DE',
  CDG: 'FR', MRS: 'FR', LYS: 'FR', MAD: 'ES', BCN: 'ES', LIS: 'PT',
  MXP: 'IT', FCO: 'IT', BLQ: 'IT', VIE: 'AT', ZRH: 'CH', GVA: 'CH',
  BRU: 'BE', LUX: 'LU', CPH: 'DK', OSL: 'NO', ARN: 'SE', HEL: 'FI',
  WAW: 'PL', KRK: 'PL', PRG: 'CZ', BUD: 'HU', OTP: 'RO', SOF: 'BG',
  ATH: 'GR', SKG: 'GR', ZAG: 'HR', BEG: 'RS', KEF: 'IS', RIX: 'LV',
  TLL: 'EE', VNO: 'LT', KBP: 'UA', MSQ: 'BY', SKP: 'MK', TIA: 'AL',
  LJU: 'SI',

  // North America
  IAD: 'US', DCA: 'US', EWR: 'US', JFK: 'US', BOS: 'US', ATL: 'US',
  ORD: 'US', MDW: 'US', DFW: 'US', IAH: 'US', DEN: 'US', SEA: 'US',
  SJC: 'US', SFO: 'US', OAK: 'US', LAX: 'US', ONT: 'US', SAN: 'US',
  PHX: 'US', LAS: 'US', SLC: 'US', MSP: 'US', DTW: 'US', CLE: 'US',
  CMH: 'US', PIT: 'US', BNA: 'US', MCI: 'US', STL: 'US', MCO: 'US',
  MIA: 'US', TPA: 'US', CLT: 'US', RDU: 'US', PDX: 'US', HNL: 'US',
  ANC: 'US', YYZ: 'CA', YUL: 'CA', YVR: 'CA', YYC: 'CA', YOW: 'CA',
  MEX: 'MX', GDL: 'MX',

  // South America
  GRU: 'BR', GIG: 'BR', BSB: 'BR', REC: 'BR', POA: 'BR', CGH: 'BR',
  EZE: 'AR', SCL: 'CL', BOG: 'CO', LIM: 'PE', UIO: 'EC', MVD: 'UY',
  ASU: 'PY', CCS: 'VE', PTY: 'PA', SJO: 'CR',

  // Africa
  JNB: 'ZA', CPT: 'ZA', DUR: 'ZA', LOS: 'NG', ABV: 'NG', NBO: 'KE',
  ACC: 'GH', CAI: 'EG', ALG: 'DZ', CMN: 'MA', TUN: 'TN', ADD: 'ET',
  DAR: 'TZ', KGL: 'RW', LUN: 'ZM', HRE: 'ZW', MRU: 'MU',

  // Asia-Pacific
  NRT: 'JP', HND: 'JP', KIX: 'JP', ICN: 'KR', PUS: 'KR', HKG: 'HK',
  TPE: 'TW', KHH: 'TW', SIN: 'SG', KUL: 'MY', CGK: 'ID', DPS: 'ID',
  MNL: 'PH', BKK: 'TH', HAN: 'VN', SGN: 'VN', PNH: 'KH', RGN: 'MM',
  DAC: 'BD', CMB: 'LK', KTM: 'NP', BOM: 'IN', DEL: 'IN', MAA: 'IN',
  BLR: 'IN', CCU: 'IN', HYD: 'IN', SYD: 'AU', MEL: 'AU', BNE: 'AU',
  PER: 'AU', ADL: 'AU', AKL: 'NZ', ULN: 'MN',

  // China (Cloudflare's China Network, operated via local partners)
  PVG: 'CN', PEK: 'CN', CAN: 'CN', SZX: 'CN',
}

/** Looks up the ISO 3166-1 alpha-2 country for a Cloudflare colo code, or null if unknown. */
export function countryForColo(colo: string | null | undefined): string | null {
  if (!colo) return null
  return COLO_COUNTRY[colo.toUpperCase()] ?? null
}
