/**
 * Reusable Temperature Conversion and Display Utility
 * 
 * Rules per specification:
 * - Internal canonical store always maintains temperature in Celsius (°C).
 * - Patient-facing cards, doctor dashboards, attender dashboards, reports, and summaries display in Fahrenheit (°F).
 * - Formula: F = (C * 9/5) + 32
 * - Avoid double conversion.
 */

/**
 * Converts a Celsius temperature value to Fahrenheit, rounded to 1 decimal place.
 * Example: 37.0°C -> 98.6°F
 */
export function celsiusToFahrenheit(celsius: number): number {
  if (typeof celsius !== 'number' || isNaN(celsius)) return 98.6;
  const f = (celsius * 9) / 5 + 32;
  return Number(f.toFixed(1));
}

/**
 * Formats a temperature value stored in Celsius into a clean Fahrenheit string with unit.
 * Example: 36.8 -> "98.2 °F"
 */
export function formatTemperatureF(celsius: number): string {
  const f = celsiusToFahrenheit(celsius);
  return `${f} °F`;
}

/**
 * Formats only the numerical value in Fahrenheit.
 * Example: 37.0 -> "98.6"
 */
export function formatTemperatureVal(celsius: number): string {
  return celsiusToFahrenheit(celsius).toFixed(1);
}

/**
 * Normal range text in Fahrenheit for cards and telemetry panels.
 * In Celsius: 36.5 - 37.5 °C -> In Fahrenheit: 97.7 - 99.5 °F
 */
export const FAHRENHEIT_NORMAL_RANGE_TEXT = '97.7 - 99.5 °F';

/**
 * Returns a calm, human-friendly status description for caregiver/clinical view.
 */
export function getTemperatureStatusDescription(celsius: number): string {
  const f = celsiusToFahrenheit(celsius);
  if (celsius >= 39.0) {
    return `High fever (${f} °F) — Nurse alerted`;
  }
  if (celsius >= 37.8) {
    return `Elevated temperature / mild fever (${f} °F)`;
  }
  if (celsius < 35.5) {
    return `Low temperature warning (${f} °F)`;
  }
  return `Target temperature range (${f} °F)`;
}
