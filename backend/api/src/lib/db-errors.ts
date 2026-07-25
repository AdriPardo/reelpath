/** Errores de Prisma/Postgres por tablas o columnas aún no migradas. */
export function isDbSchemaError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code === 'P2021' || code === 'P2022') return true;
  }

  const message = err instanceof Error ? err.message : String(err);
  return /does not exist|relation .* does not exist/i.test(message);
}
