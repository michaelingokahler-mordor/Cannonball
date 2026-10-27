import type { BodyStyle } from './model.ts';

/** Physical lateral half-widths. Resolution and sprite density never change them. */
export function vehicleHalfWidth(body:BodyStyle|'truck'):number {
  return body==='truck'?.23:body==='van'||body==='rv'?.20:.185;
}
