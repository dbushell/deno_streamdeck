export type DeckInfoReport = readonly [
  length: number,
  offset: number,
  ...data: number[]
];

export interface DeckInfo {
  readonly vendorId: number;
  readonly productId: number;
  readonly keyCount: number;
  readonly keyLayout: readonly [number, number];
  readonly keySize: readonly [number, number];
  readonly keyFlip: readonly [boolean, boolean];
  readonly keyRotation: number;
  readonly keyStateOffset: number;
  readonly keyImageFormat: 'JPEG' | 'BMP';
  readonly reportSize: readonly [number, number];
  readonly firmwareReport: DeckInfoReport;
  readonly resetReport: DeckInfoReport;
  readonly brightnessReport: DeckInfoReport;
  firmware?: string;
}
