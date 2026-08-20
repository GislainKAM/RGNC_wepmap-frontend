import type { MetadataRoute } from 'next'

// Le robots.txt servi sur le domaine était, à l'octet près, celui managé
// par Cloudflare : uniquement des commentaires sur les content signals,
// aucune règle, aucun sitemap. Il ne s'applique qu'à défaut de robots.txt
// à l'origine — vérifié sur geometres.websig.app, où celui de
// l'application a repris la main dès son déploiement.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Doublon volontaire des balises robots noindex posées par les
        // layouts : le disallow évite le crawl, la balise évite
        // l'indexation. Les deux ne font pas le même travail.
        disallow: ['/admin', '/profil', '/auth'],
      },
    ],
    sitemap: 'https://rgnc.websig.app/sitemap.xml',
    host: 'https://rgnc.websig.app',
  }
}
