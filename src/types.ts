export interface DeckInfo {
  readonly vendorId: number;
  readonly productId: number;
  readonly keyCount: number;
  readonly keyLayout: readonly [number, number];
  readonly keySize: readonly [number, number];
  readonly keyFlip: readonly [boolean, boolean];
  readonly keyRotation: number;
  readonly imageFormat: 'JPEG' | 'BMP';
  readonly reportSize: readonly [number, number];
  readonly firmwareFeature: readonly [number, number, number];
  firmware?: string;
}
