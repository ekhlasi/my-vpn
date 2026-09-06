// ==================== Discovery proxies (SOCKS4, per country) ====================
//
// Used only for STAGE 1 (discovery) of the clean-IP mechanism: the Worker tunnels
// a DoH query through one of these to find the Cloudflare edge IP for that
// network path. STAGE 2 (validation) never goes through these — it always
// connects directly (see sniHandshake in ip-scanner.ts), because that's what
// actually matters for real users.
//
// This is a capped subset (10-ish per country) of clean-ip-scanner/proxy/*.txt,
// kept small on purpose to stay within a single Worker request's time budget.
// Most of these are public/scraped SOCKS4 proxies, not servers you personally
// rented — replace this list with your own SOCKS4 servers per country whenever
// you have them; the mechanism doesn't care where the proxy comes from, only
// that it actually sits in that country's network.

export interface DiscoveryProxy {
  ip: string
  port: number
  country: string
}

export const DISCOVERY_PROXIES: DiscoveryProxy[] = [
  // Germany
  { ip: '8.211.49.86', port: 10801, country: 'DE' },
  { ip: '47.91.89.3', port: 3128, country: 'DE' },
  { ip: '91.98.86.26', port: 8888, country: 'DE' },
  { ip: '8.209.96.245', port: 89, country: 'DE' },
  { ip: '144.24.171.189', port: 555, country: 'DE' },
  { ip: '72.56.106.48', port: 443, country: 'DE' },
  { ip: '150.241.107.0', port: 1080, country: 'DE' },
  { ip: '141.147.10.92', port: 555, country: 'DE' },
  { ip: '57.129.120.78', port: 9050, country: 'DE' },
  { ip: '8.211.49.86', port: 8443, country: 'DE' },

  // Turkey
  { ip: '91.205.41.109', port: 52606, country: 'TR' },
  { ip: '5.188.190.218', port: 80, country: 'TR' },
  { ip: '213.14.31.123', port: 35314, country: 'TR' },
  { ip: '88.247.31.164', port: 4153, country: 'TR' },
  { ip: '185.87.121.5', port: 8975, country: 'TR' },
  { ip: '37.247.96.234', port: 4153, country: 'TR' },
  { ip: '88.255.102.114', port: 1082, country: 'TR' },
  { ip: '144.225.65.83', port: 9082, country: 'TR' },
  { ip: '92.45.19.35', port: 5678, country: 'TR' },
  { ip: '194.62.52.29', port: 9050, country: 'TR' },

  // Azerbaijan
  { ip: '213.172.89.227', port: 4153, country: 'AZ' },
  { ip: '185.43.189.182', port: 3629, country: 'AZ' },
  { ip: '217.64.30.216', port: 3128, country: 'AZ' },
  { ip: '185.43.189.253', port: 3629, country: 'AZ' },
  { ip: '185.118.51.230', port: 3128, country: 'AZ' },
  { ip: '109.127.9.99', port: 8080, country: 'AZ' },

  // UAE
  { ip: '176.37.107.86', port: 11111, country: 'UAE' },
  { ip: '195.140.226.32', port: 5678, country: 'UAE' },
  { ip: '195.114.7.6', port: 1080, country: 'UAE' },
  { ip: '195.78.100.186', port: 3629, country: 'UAE' },
  { ip: '176.120.32.135', port: 5678, country: 'UAE' },
  { ip: '31.43.33.56', port: 4153, country: 'UAE' },
  { ip: '91.200.114.58', port: 55749, country: 'UAE' },
  { ip: '80.92.227.185', port: 5678, country: 'UAE' },
  { ip: '185.43.249.148', port: 39316, country: 'UAE' },
  { ip: '193.200.151.69', port: 32777, country: 'UAE' },
]

export function proxiesForCountry(country: string): DiscoveryProxy[] {
  const c = (country || 'ALL').toUpperCase()
  if (c === 'ALL') return DISCOVERY_PROXIES
  return DISCOVERY_PROXIES.filter((p) => p.country === c)
}
