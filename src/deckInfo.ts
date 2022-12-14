import {DeckType, DeckInfo} from './types.ts';

export const deckInfo: {[key in DeckType]: DeckInfo} = {
  [DeckType.MINI]: {
    vendorId: 0x0fd9,
    productId: 0x0063,
    keyCount: 6,
    keyLayout: [3, 2],
    keySize: [80, 80],
    keyFlip: [false, true],
    keyRotation: 90,
    keyStateOffset: 1,
    keyImageFormat: 'BMP',
    reportSize: [1024, 16],
    firmwareReport: [17, 5, 0x04],
    resetReport: [17, 0, 0x0b, 0x63],
    brightnessReport: [17, 0, 0x05, 0x55, 0xaa, 0xd1, 0x01]
  },
  [DeckType.ORIGINAL]: {
    vendorId: 0x0fd9,
    productId: 0x0060,
    keyCount: 15,
    keyLayout: [5, 3],
    keySize: [72, 72],
    keyFlip: [true, true],
    keyRotation: 0,
    keyStateOffset: 1,
    keyImageFormat: 'BMP',
    reportSize: [8191, 16],
    firmwareReport: [17, 5, 0x04],
    resetReport: [17, 0, 0x0b, 0x63],
    brightnessReport: [17, 0, 0x05, 0x55, 0xaa, 0xd1, 0x01]
  },
  [DeckType.MK2]: {
    vendorId: 0x0fd9,
    productId: 0x0080,
    keyCount: 15,
    keyLayout: [5, 3],
    keySize: [72, 72],
    keyFlip: [true, true],
    keyRotation: 0,
    keyStateOffset: 4,
    keyImageFormat: 'JPEG',
    reportSize: [1024, 8],
    firmwareReport: [32, 6, 0x05],
    resetReport: [32, 0, 0x03, 0x02],
    brightnessReport: [32, 0, 0x03, 0x08]
  },
  [DeckType.XL]: {
    vendorId: 0x0fd9,
    productId: 0x006c,
    keyCount: 32,
    keyLayout: [8, 4],
    keySize: [96, 96],
    keyFlip: [true, true],
    keyRotation: 0,
    keyStateOffset: 4,
    keyImageFormat: 'JPEG',
    reportSize: [1024, 8],
    firmwareReport: [32, 6, 0x05],
    resetReport: [32, 0, 0x03, 0x02],
    brightnessReport: [32, 0, 0x03, 0x08]
  }
} as const;
