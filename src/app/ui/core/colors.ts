/** Material colour roles available as `--mat-sys-*` custom properties. */
export const COLOR_ROLES = new Set([
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'on-primary-fixed',
  'on-primary-fixed-variant',
  'inverse-primary',
  'secondary',
  'on-secondary',
  'secondary-container',
  'on-secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'on-secondary-fixed',
  'on-secondary-fixed-variant',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'tertiary-fixed',
  'tertiary-fixed-dim',
  'on-tertiary-fixed',
  'on-tertiary-fixed-variant',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'surface',
  'on-surface',
  'surface-dim',
  'surface-bright',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'on-surface-variant',
  'outline',
  'outline-variant',
  'inverse-surface',
  'inverse-on-surface',
  'shadow',
  'scrim',
  'surface-tint',
]);

/**
 * Resolves a colour input: an M3 role name (`'primary'`,
 * `'secondary-container'`, also camelCase `'onPrimary'`) becomes
 * `var(--mat-sys-…)`, a custom property name (`'--x'`) becomes `var(--x)`,
 * anything else is used as a CSS colour as-is.
 */
export function cssColor(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('--')) return `var(${value})`;
  const kebab = value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return COLOR_ROLES.has(kebab) ? `var(--mat-sys-${kebab})` : value;
}
