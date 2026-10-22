/**
 * Garde-fou de syntaxe PHP pour les déploiements.
 *
 * Un unique ParseError dans un fichier PHP suffit à rendre le conteneur
 * Symfony incapable de démarrer : le conteneur compile ses services au
 * boot, donc la classe fautive est chargée avant même le premier appel.
 * Conséquence observée en production : aucune commande console ne
 * fonctionne (pas même `app:repair-schema` ni `doctrine:migrations:migrate`),
 * et le backend ne répond plus.
 *
 * `php -l` n'est pas disponible dans l'environnement de build frontend,
 * d'où ce contrôle structurel : blocs équilibrés, chaînes terminées,
 * heredocs, variables malformées (`$ dossier`). Il ne remplace pas un
 * analyseur PHP complet, mais couvre la famille d'erreurs qui a mis la
 * production hors service.
 *
 * Usage : node tools/check-php-syntax.cjs [répertoire...]
 */
const fs = require('fs')
const path = require('path')

const paires = { '{': '}', '(': ')', '[': ']' }

function analyser(source) {
  const problemes = []
  let i = 0
  const n = source.length
  let ligne = 1
  const pile = []

  const ajouter = (message) => problemes.push(`ligne ${ligne} : ${message}`)

  while (i < n) {
    const c = source[i]
    const d = source[i + 1]

    if (c === '\n') {
      ligne++
      i++
      continue
    }
    if (c === '/' && d === '/') {
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '#' && d !== '[') {
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && d === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') ligne++
        i++
      }
      i += 2
      continue
    }
    if (c === '<' && source.slice(i, i + 3) === '<<<') {
      const m = /^<<<\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\r?\n/.exec(source.slice(i))
      if (m) {
        const suite = source.slice(i + m[0].length)
        const indexFin = suite.search(new RegExp(`^[ \\t]*${m[1]}\\b`, 'm'))
        if (indexFin === -1) {
          ajouter('heredoc non terminé')
          break
        }
        ligne += (source.slice(0, i + m[0].length + indexFin).match(/\n/g) || []).length
        i += m[0].length + indexFin
        continue
      }
    }
    if (c === "'" || c === '"') {
      const quote = c
      i++
      let terminee = false
      while (i < n) {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === '\n') ligne++
        if (source[i] === quote) {
          i++
          terminee = true
          break
        }
        i++
      }
      if (!terminee) {
        ajouter(`chaîne ${quote} non terminée`)
        break
      }
      continue
    }
    if (paires[c]) {
      pile.push({ car: c, ligne })
      i++
      continue
    }
    if (c === '}' || c === ')' || c === ']') {
      const attendu = pile.pop()
      if (!attendu || paires[attendu.car] !== c) {
        ajouter(`fermeture '${c}' inattendue`)
      }
      i++
      continue
    }
    i++
  }

  if (pile.length > 0) {
    problemes.push(
      `${pile.length} bloc(s) non fermé(s) : ${pile.map((p) => `${p.car} ligne ${p.ligne}`).join(', ')}`,
    )
  }

  // Variables malformées : `$ dossier` (DollarInterpolation invalide).
  const horsChaines = source
    .split('\n')
    .map((l) => l.replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""'))
    .join('\n')
  horsChaines.split('\n').forEach((ligneCourte, index) => {
    if (/\$\s+[a-zA-Z_]/.test(ligneCourte)) {
      problemes.push(`ligne ${index + 1} : variable malformée (${ligneCourte.trim().slice(0, 80)})`)
    }
  })

  return problemes
}

const cibles = []
const parcourir = (repertoire) => {
  for (const entree of fs.readdirSync(repertoire, { withFileTypes: true })) {
    if (['vendor', 'node_modules', '.git', 'var'].includes(entree.name)) continue
    const complet = path.join(repertoire, entree.name)
    if (entree.isDirectory()) parcourir(complet)
    else if (entree.name.endsWith('.php')) cibles.push(complet)
  }
}

const argumentsProcessus = process.argv.slice(2)
const repertoires = argumentsProcessus.length > 0 ? argumentsProcessus : ['src', 'migrations']
for (const repertoire of repertoires) {
  if (fs.existsSync(repertoire) && fs.statSync(repertoire).isDirectory()) parcourir(repertoire)
}

let total = 0
for (const fichier of cibles) {
  const problemes = analyser(fs.readFileSync(fichier, 'utf8'))
  if (problemes.length > 0) {
    total += problemes.length
    console.log(`\n${fichier}`)
    for (const probleme of problemes) console.log(`   - ${probleme}`)
  }
}

if (total === 0) {
  console.log(`Syntaxe PHP : ${cibles.length} fichier(s) sans anomalie structurelle.`)
  process.exit(0)
}

console.error(`\n${total} anomalie(s) PHP : le backend ne démarrerait pas.`)
process.exit(1)
