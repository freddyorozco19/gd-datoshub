/* Iniciales de una persona tal como Odoo escribe los nombres: "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2".
   Resultado: primer nombre + primer apellido (AREVALO PARGA IVAN DARIO → "IA"). Se ignoran las partículas (DE, DEL, LA…).
   Con dos palabras se asume "APELLIDO NOMBRE"; con una sola se usan sus dos primeras letras. */
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "san", "santa"]);

export function personInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !PARTICLES.has(w.toLowerCase()));
  const w = core.length ? core : words;
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  const surname = w[0];
  const given = w.length >= 3 ? w[2] : w[1];
  return (given[0] + surname[0]).toUpperCase();
}
