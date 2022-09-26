import {HID, HIDInfo} from 'https://deno.land/x/deno_usbhidapi@v0.2.1/mod.ts';
import JPEG from 'https://cdn.skypack.dev/jpeg-js?dts';
import {DeckType, DeckInfo} from './types.ts';
import {deckInfo} from './deckInfo.ts';

export class StreamDeck extends EventTarget {
  // HIDAPI pointer
  #hid: bigint;

  // Device and HIDAPI information
  #type: DeckType;
  #info: DeckInfo;
  #hidInfo: HIDInfo | null;

  #keyStates: boolean[];
  #keyBlank: Uint8Array;

  #conTimeout = 0;
  #conInterval = 0;
  #conRate = 1000;

  /**
   * Create a new StreamDeck instance
   * @param type a known device type
   */
  constructor(type: DeckType) {
    super();
    this.#type = type;
    this.#info = {...deckInfo[type]};
    this.#hidInfo = null;
    this.#hid = 0n;

    // Set default off state for all keys
    this.#keyStates = Array(this.keyCount).fill(false);

    // Generate black image data for off state
    this.#keyBlank = new Uint8Array(this.keySize[0] * this.keySize[1] * 4);

    // Add event listeners
    this.addEventListener('open', this.#onOpen);
    this.addEventListener('close', this.#onClose);
  }

  get hid(): bigint {
    return this.#hid;
  }

  get type(): DeckType {
    return this.#type;
  }

  get info(): DeckInfo {
    return this.#info;
  }

  get hidInfo(): HIDInfo | null {
    return this.#hidInfo;
  }

  get keyCount(): DeckInfo['keyCount'] {
    return this.#info.keyCount;
  }

  get keyLayout(): DeckInfo['keyLayout'] {
    return this.#info.keyLayout;
  }

  get keySize(): DeckInfo['keySize'] {
    return this.#info.keySize;
  }

  get keyFlip(): DeckInfo['keyFlip'] {
    return this.#info.keyFlip;
  }

  get keyRotation(): DeckInfo['keyRotation'] {
    return this.#info.keyRotation;
  }

  get keyStates(): boolean[] {
    return [...this.#keyStates];
  }

  get keyBlank(): Uint8Array {
    return this.#keyBlank;
  }

  /**
   * True if device was opened
   */
  get isOpen(): boolean {
    return this.hid !== 0n;
  }

  /**
   * True is device was opened and is connected
   */
  get isConnected(): boolean {
    if (!this.isOpen) return false;
    const devices = HID.enumerate(this.info.vendorId, this.info.productId);
    return devices.length > 0;
  }

  /**
   * Initialize HIDAPI and open the Stream Deck device
   * (`open` event is dispatched on connection)
   */
  open(): void {
    // Ensure previous device is closed
    this.close();
    // Initialize HID
    HID.init();
    // Find and setup device through enumeration
    const {vendorId, productId} = this.info;
    const devices = HID.enumerate(vendorId, productId);
    const found = devices.find((hidInfo) => {
      if (hidInfo.vendorId === vendorId && hidInfo.productId === productId) {
        this.#hid = HID.open(vendorId, productId);
        this.#hidInfo = {...hidInfo};
        return true;
      }
    });
    if (found) {
      this.dispatchEvent(new CustomEvent('open'));
    } else {
      // Start poll timer if not found
      this.#conTimeout = setTimeout(() => {
        this.open();
      }, this.#conRate);
    }
  }

  /**
   * Close the Stream Deck device and exit HIDAPI
   * (`close` event is dispatched on disconnection)
   * @returns true if the connected device was closed
   */
  close(): boolean {
    clearTimeout(this.#conTimeout);
    clearInterval(this.#conInterval);
    const wasConnected = this.isConnected;
    if (wasConnected) {
      HID.close(this.hid);
    }
    this.#hid = 0n;
    HID.exit();
    if (wasConnected) {
      this.dispatchEvent(new CustomEvent('close'));
    }
    return wasConnected;
  }

  #onOpen() {
    // Get firmware from feature report
    const [length, offset, ...arr] = this.info.firmwareReport;
    const data = new Uint8Array(length);
    data.set(arr, 0);
    HID.getFeatureReport(this.hid, data);
    this.#info.firmware = new TextDecoder().decode(
      data.subarray(offset, data.indexOf(0))
    );
    // Start poll interval to auto-reconnect
    this.#conInterval = setInterval(() => {
      if (!this.isConnected) {
        this.dispatchEvent(new CustomEvent('disconnect'));
        this.open();
      }
    }, this.#conRate);
  }

  #onClose() {
    // Do nothing...
  }

  /**
   * Reset the Stream Deck
   */
  reset(): void {
    const [length, , ...arr] = this.info.resetReport;
    const data = new Uint8Array(length);
    data.set(arr, 0);
    HID.sendFeatureReport(this.hid, data);
  }

  /**
   * Set Stream Deck display brightness
   * @param percent brightness percentage (0–100)
   */
  brightness(percent: number): void {
    const [length, , ...arr] = this.info.brightnessReport;
    const data = new Uint8Array(length);
    data.set([...arr, Math.max(0, Math.min(100, percent))], 0);
    HID.sendFeatureReport(this.hid, data);
  }

  /**
   * Set an individual Stream Deck key image
   * @param key 0-based key index
   * @param data raw 32-bit RGBA image data
   */
  setKeyData(key: number, data: Uint8Array): void {
    if (key < 0 || key >= this.keyCount) {
      throw new RangeError('Key index out of range');
    }
    // Flip the image as per the device
    data = this.flipKeyData(data);
    // Always re-encode to ensure correct format
    switch (this.info.keyImageFormat) {
      case 'BMP':
        throw new Error('Bitmap support not implemented');
      case 'JPEG':
        data = JPEG.encode(
          {
            width: this.keySize[0],
            height: this.keySize[1],
            data
          },
          100
        ).data;
        break;
    }
    // Write data to device in chunks
    const [reportLength, headerLength] = this.#info.reportSize;
    const maxLength = reportLength - headerLength;
    let count = 0;
    let remaining = data.length;
    while (remaining > 0) {
      const length = Math.min(remaining, maxLength);
      const sent = count * maxLength;
      const header = new Uint8Array(headerLength);
      header.set([
        0x02,
        0x07,
        key,
        length === remaining ? 1 : 0,
        length & 0xff,
        length >> 8,
        count & 0xff,
        count >> 8
      ]);
      const payload = new Uint8Array(reportLength);
      payload.set(header);
      payload.set(data.subarray(sent, sent + length), header.length);
      HID.write(this.hid, payload);
      remaining -= length;
      count++;
    }
  }

  /**
   * Set an individual Stream Deck key image
   * @param key 0-based key index
   * @param path full path to the JPEG image file
   */
  setKeyJpeg(key: number, path: string): void {
    if (this.info.keyImageFormat !== 'JPEG') {
      throw new Error('Device does not support JPEG format');
    }
    const file = Deno.readFileSync(path);
    const jpeg = JPEG.decode(file);
    this.setKeyData(key, jpeg.data);
  }

  /**
   * Set an individual Stream Deck key image
   * @param key 0-based key index
   * @param path full path to the BMP image file
   */
  setKeyBitmap(key: number, path: string): void {
    if (this.info.keyImageFormat !== 'BMP') {
      throw new Error('Device does not support Bitmap format');
    }
    throw new Error('Bitmap support not implemented');
  }

  /**
   * Flip raw image data to match device settings
   * @param data raw 32-bit RGBA image data
   * @returns data flipped as needed
   */
  flipKeyData(data: Uint8Array): Uint8Array {
    if (this.keyFlip.indexOf(true)) {
      return data;
    }
    const newData = new Uint8Array(data.length);
    // Iterate over pixel rows (top to bottom)
    for (let y = 0; y < this.keySize[1]; y++) {
      const iy = y * this.keySize[0] * 4;
      let offset = iy;
      // Invert the row offset to vertically flip
      if (this.keyFlip[1]) {
        offset = data.length - iy - this.keySize[0] * 4;
      }
      const row = data.slice(iy, iy + this.keySize[0] * 4);
      if (this.keyFlip[0]) {
        // Reverse the row to horizontally flip
        for (let x = 0; x < this.keySize[0]; x++) {
          const ix = iy + (this.keySize[0] - 1 - x) * 4;
          row.set(data.slice(ix, ix + 4), x * 4);
        }
      }
      newData.set(row, offset);
    }
    return newData;
  }

  /**
   * Wait for Stream Deck key input and update key states
   * (`keystates` event is dispatched on input)
   * @returns true if key states were updated
   */
  async readKeys(): Promise<boolean> {
    try {
      const read = await HID.read(
        this.hid,
        this.info.keyStateOffset + this.keyCount
      );
      read.subarray(4).forEach((value, i) => {
        this.#keyStates[i] = Boolean(value);
      });
      this.dispatchEvent(new CustomEvent('keystates'));
      return true;
    } catch {
      // Device was probably disconnected
      return false;
    }
  }

  /**
   * Wait for Stream Deck key input and yield key states
   * @yields key states
   */
  async *listenKeys(): AsyncGenerator<boolean[]> {
    while (this.isOpen) {
      const success = await this.readKeys();
      if (success) yield this.keyStates;
    }
  }
}
