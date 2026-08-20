// Génère src/app/favicon.ico et src/app/apple-icon.png depuis la marque
// RGNC WebMap.
//
// Pourquoi un script et pas un binaire déposé à la main : l'icône dérive de
// src/app/icon.svg, et une marque qui change sans que les rasters suivent,
// c'est un onglet qui ment. `npm run favicon` régénère les deux.
//
// Pas de dépendance : ni sharp (binaire natif, casse en CI slim) ni un
// rasteriseur SVG. La marque réduite est faite de trois primitives —
// rectangle arrondi, anneau, disque — qu'on échantillonne directement.
// zlib suffit pour le PNG, le format ICO se réduit à un en-tête plus des
// DIB 32 bits.
//
// Marque réduite, et non la marque complète de
// public/assets/logo/rgnc-webmap-mark.svg : le cercle intérieur en
// pointillés (dasharray 2 3) et les quatre tiques cardinales ne survivent
// pas à 16 px, où elles se réduisent à une bouillie grise. Ne restent que
// ce qui porte la silhouette — l'anneau et le point central. Le tracé DOIT
// rester synchronisé avec src/app/icon.svg.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const VERT = [0x1f, 0x5d, 0x3a];
const BLANC = [0xff, 0xff, 0xff];
const ORANGE = [0xb8, 0x57, 0x29];

// Géométrie en repère 0..100, miroir de src/app/icon.svg.
const RAYON_COIN = 18;
const ANNEAU = { r: 33, demi: 6 };
const HALO = 17; // disque blanc sous le point : #B85729 sur #1F5D3A ne
                 // donne qu'un rapport de contraste de 1,7 — le point
                 // disparaîtrait dans le fond sans ce liseré.
const POINT = 12;

const distanceRectArrondi = (x, y) => {
  const qx = Math.abs(x - 50) - (50 - RAYON_COIN);
  const qy = Math.abs(y - 50) - (50 - RAYON_COIN);
  const dehors = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return dehors + Math.min(Math.max(qx, qy), 0) - RAYON_COIN;
};

// Couleur d'un sous-échantillon, ou null s'il tombe hors de la tuile.
const couleur = (x, y) => {
  if (distanceRectArrondi(x, y) >= 0) return null;
  const d = Math.hypot(x - 50, y - 50);
  if (d < POINT) return ORANGE;
  if (d < HALO) return BLANC;
  if (Math.abs(d - ANNEAU.r) < ANNEAU.demi) return BLANC;
  return VERT;
};

// Rendu par suréchantillonnage. 8x8 et non 4x4 : 4x4 ne donne que 17
// niveaux d'alpha sur un pixel de bord, assez pour un segment droit mais
// pas pour un cercle, où le dégradé se voit en marches. 64 sous-pixels
// lissent l'anneau, pour un coût de rendu qui reste sous la seconde.
const SOUS_ECHANTILLONS = 8;

function rasteriser(taille) {
  const rgba = Buffer.alloc(taille * taille * 4);
  const pas = 1 / SOUS_ECHANTILLONS;
  for (let py = 0; py < taille; py++) {
    for (let px = 0; px < taille; px++) {
      let couverture = 0;
      let r = 0;
      let v = 0;
      let b = 0;
      for (let sy = 0; sy < SOUS_ECHANTILLONS; sy++) {
        for (let sx = 0; sx < SOUS_ECHANTILLONS; sx++) {
          const c = couleur(
            ((px + (sx + 0.5) * pas) / taille) * 100,
            ((py + (sy + 0.5) * pas) / taille) * 100
          );
          if (!c) continue;
          couverture++;
          r += c[0];
          v += c[1];
          b += c[2];
        }
      }
      if (couverture === 0) continue;
      const i = (py * taille + px) * 4;
      rgba[i] = Math.round(r / couverture);
      rgba[i + 1] = Math.round(v / couverture);
      rgba[i + 2] = Math.round(b / couverture);
      rgba[i + 3] = Math.round((couverture / (SOUS_ECHANTILLONS * SOUS_ECHANTILLONS)) * 255);
    }
  }
  return rgba;
}

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = -1;
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const morceauPng = (type, donnees) => {
  const corps = Buffer.concat([Buffer.from(type, 'latin1'), donnees]);
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, somme]);
};

function encoderPng(rgba, taille) {
  // Filtre 0 sur chaque ligne : l'icône est un aplat, les filtres adaptatifs
  // ne gagneraient que quelques octets pour beaucoup de code.
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y++) {
    brut[y * (taille * 4 + 1)] = 0;
    rgba.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceauPng('IHDR', ihdr),
    morceauPng('IDAT', deflateSync(brut, { level: 9 })),
    morceauPng('IEND', Buffer.alloc(0))
  ]);
}

// DIB et non PNG dans l'ICO : le PNG embarqué n'est lu que depuis Vista et
// reste mal supporté par les agrégateurs qui vont chercher /favicon.ico.
function encoderDib(rgba, taille) {
  const entete = Buffer.alloc(40);
  entete.writeUInt32LE(40, 0);
  entete.writeInt32LE(taille, 4);
  entete.writeInt32LE(taille * 2, 8); // XOR + AND empilés
  entete.writeUInt16LE(1, 12);
  entete.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(taille * taille * 4);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const src = (y * taille + x) * 4;
      const dst = ((taille - 1 - y) * taille + x) * 4; // DIB : lignes de bas en haut
      xor[dst] = rgba[src + 2];
      xor[dst + 1] = rgba[src + 1];
      xor[dst + 2] = rgba[src];
      xor[dst + 3] = rgba[src + 3];
    }
  }
  // Masque AND à zéro : l'opacité est portée par le canal alpha du XOR.
  const octetsParLigne = Math.ceil(taille / 32) * 4;
  return Buffer.concat([entete, xor, Buffer.alloc(octetsParLigne * taille)]);
}

function encoderIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(1, 2);
  entete.writeUInt16LE(images.length, 4);
  let decalage = 6 + images.length * 16;
  const entrees = [];
  for (const { taille, dib } of images) {
    const e = Buffer.alloc(16);
    e[0] = taille;
    e[1] = taille;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(dib.length, 8);
    e.writeUInt32LE(decalage, 12);
    decalage += dib.length;
    entrees.push(e);
  }
  return Buffer.concat([entete, ...entrees, ...images.map((i) => i.dib)]);
}

const ico = encoderIco(
  // Plus grande taille en tête : Next ne lit que la première entrée du
  // répertoire ICO pour renseigner l'attribut sizes du <link>. Rangé dans
  // l'autre sens, la balise annonçait 16x16 pour un fichier qui monte à 48.
  // 64 px pour les onglets sur écran HiDPI, où un 32 px est étiré. On ne
  // monte pas plus haut : les DIB ne sont pas compressés, un 128 px
  // triplerait à lui seul le poids du fichier — et au-delà de 64 px,
  // c'est icon.svg, vectoriel, qui prend le relais.
  [64, 48, 32, 16].map((taille) => ({ taille, dib: encoderDib(rasteriser(taille), taille) }))
);
writeFileSync(join(RACINE, 'src', 'app', 'favicon.ico'), ico);

// 180 px : format attendu par iOS pour l'écran d'accueil.
writeFileSync(join(RACINE, 'src', 'app', 'apple-icon.png'), encoderPng(rasteriser(180), 180));

console.log(`favicon.ico ${ico.length} o · apple-icon.png généré`);
