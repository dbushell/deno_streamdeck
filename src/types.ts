export enum DeckType {
  MINI = 'Stream Deck Mini',
  ORIGINAL = 'Stream Deck Original',
  MK2 = 'Stream Deck MK.2',
  XL = 'Stream Deck XL'
}

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
