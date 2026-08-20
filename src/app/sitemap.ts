import type { MetadataRoute } from 'next'

// /sitemap.xml renvoyait 404 et rien ne le déclarait.
//
// Deux URL seulement : le reste de l'application est derrière
// authentification (/admin, /profil, /auth) et porte une balise robots
// noindex. L'accueil y figure bien qu'il ne soit qu'une redirection côté
// client — c'est l'URL que les gens partagent et celle que Google affiche.
//
// Ni lastModified ni changeFrequency ni priority : Google ignore les deux
// derniers depuis longtemps, et le premier vaudrait la date de la dernière
// image Docker, pas celle du contenu. Un lastmod qui ment coûte plus qu'un
// lastmod absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://rgnc.websig.app'
  return [{ url: `${base}/` }, { url: `${base}/map` }]
}
