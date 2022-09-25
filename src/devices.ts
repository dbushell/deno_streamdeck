import {DeckInfo} from './types.ts';

export const devices: {[key: string]: DeckInfo} = {
  mini: {
    vendorId: 0x0fd9,
    productId: 0x0063,
    keyCount: 6,
    keyLayout: [3, 2],
    keySize: [80, 80],
    keyFlip: [false, true],
    keyRotation: 90,
    imageFormat: 'BMP',
    reportSize: [1024, 16],
    firmwareFeature: [0x04, 17, 5]
  },
  original: {
    vendorId: 0x0fd9,
    productId: 0x0060,
    keyCount: 15,
    keyLayout: [5, 3],
    keySize: [72, 72],
    keyFlip: [true, true],
    keyRotation: 0,
    imageFormat: 'BMP',
    reportSize: [8191, 16],
    firmwareFeature: [0x04, 17, 5]
  },
  mk2: {
    vendorId: 0x0fd9,
    productId: 0x0080,
    keyCount: 15,
    keyLayout: [5, 3],
    keySize: [72, 72],
    keyFlip: [true, true],
    keyRotation: 0,
    imageFormat: 'JPEG',
    reportSize: [1024, 8],
    firmwareFeature: [0x05, 32, 6]
  },
  xl: {
    vendorId: 0x0fd9,
    productId: 0x006c,
    keyCount: 32,
    keyLayout: [8, 4],
    keySize: [96, 96],
    keyFlip: [true, true],
    keyRotation: 0,
    imageFormat: 'JPEG',
    reportSize: [1024, 8],
    firmwareFeature: [0x05, 32, 6]
  }
} as const;
