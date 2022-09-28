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

  #keyStates: number[];
  #keyBlank: Uint8Array;

  #conTimeout = 0;
  #conInterval = 0;
  #conRate = 1000;

  /**
   * Create a new StreamDeck instance
   * @param {DeckType} type - a known device type
   */
  constructor(type: DeckType) {
    super();
    this.#type = type;
    this.#info = {...deckInfo[type]};
    this.#hidInfo = null;
    this.#hid = 0n;

    // Set default off state for all keys
    this.#keyStates = Array(this.keyCount).fill(0);

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
    return this.#keyStates.map(Boolean);
  }

  get keyBlank(): Uint8Array {
    return this.#keyBlank;
  }

  /**
   * Returns true if device was opened
   */
  get isOpen(): boolean {
    return this.hid !== 0n;
  }

  /**
   * Returns true is device was opened and is connected
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
   * @returns {boolean} true if the connected device was closed
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

  #onOpen(): void {
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

  #onClose(): void {
    // Do nothing...
  }

  /**
   * Convert key index to X/Y coordinates
   * @param {number} key - key index
   * @returns {Array} X/Y coordinates
   */
  getKeyXY(key: number): [number, number] {
    const x = key % this.keyLayout[0];
    const y = (key - x) / this.keyLayout[0];
    return [x, y];
  }

  /**
   * Convert X/Y coordinates to key index
   * @param {number} x - X position of the key
   * @param {number} y - Y position of the key
   * @returns {number} key index
   */
  getKeyIndex(x: number, y: number): number {
    return y * this.keyLayout[0] + x;
  }

  /**
   * Reset the Stream Deck
   */
  reset(): void {
    if (!this.isOpen) return;
    const [length, , ...arr] = this.info.resetReport;
    const data = new Uint8Array(length);
    data.set(arr, 0);
    HID.sendFeatureReport(this.hid, data);
  }

  /**
   * Set Stream Deck display brightness
   * @param {number} percent - brightness percentage (0–100)
   */
  brightness(percent: number): void {
    if (!this.isOpen) return;
    const [length, , ...arr] = this.info.brightnessReport;
    const data = new Uint8Array(length);
    data.set([...arr, Math.max(0, Math.min(100, percent))], 0);
    HID.sendFeatureReport(this.hid, data);
  }

  /**
   * Set an individual Stream Deck key image
   * @param {number} key - zero-based key index
   * @param {Uint8Array} data - raw 32-bit RGBA image data
   */
  setKeyData(key: number, data: Uint8Array): void {
    if (!this.isOpen) return;
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
      // TODO: Original and Mini have different header formats
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
   * @param {number} key - zero-based key index
   * @param {string} path - full path to the JPEG image file
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
   * @param {number} key - zero-based key index
   * @param {string} path - full path to the BMP image file
   */
  // deno-lint-ignore no-unused-vars
  setKeyBitmap(key: number, path: string): void {
    if (this.info.keyImageFormat !== 'BMP') {
      throw new Error('Device does not support Bitmap format');
    }
    throw new Error('Bitmap support not implemented');
  }

  /**
   * Flip raw image data to match device settings
   * @param {Uint8Array} data - raw 32-bit RGBA image data
   * @returns {Uint8Array} flipped as needed
   */
  flipKeyData(data: Uint8Array): Uint8Array {
    if (this.keyFlip.indexOf(true) < 0) {
      return data;
    }
    // Use 32-bit array for easier pixel counts
    const oldData = new Uint32Array(data.buffer);
    const newData = new Uint32Array(oldData.length);
    // Iterate over pixel rows (top to bottom)
    for (let y = 0; y < this.keySize[1]; y++) {
      let offset = y * this.keySize[0];
      // Invert the row offset to vertically flip
      if (this.keyFlip[1]) {
        offset = oldData.length - (y + 1) * this.keySize[0];
      }
      const row = oldData.subarray(offset, offset + this.keySize[0]);
      // Reverse the row to horizontally flip
      if (this.keyFlip[0]) row.reverse();
      newData.set(row, y * this.keySize[0]);
    }
    return new Uint8Array(newData.buffer);
  }

  /**
   * Wait for Stream Deck key input and update key states
   * (`keystates` event is dispatched on input)
   * @returns {Promise} promise resolves true on input
   */
  async readKeys(): Promise<boolean> {
    if (!this.isOpen) return false;
    try {
      const read = await HID.read(
        this.hid,
        this.info.keyStateOffset + this.keyCount
      );
      const events = [new CustomEvent('keystates')];
      read.subarray(4).forEach((pressed, key) => {
        if (pressed) {
          // Start time event if key not already pressed
          if (!this.#keyStates[key]) {
            this.#keyStates[key] = performance.now();
            events.push(new CustomEvent('keydown', {detail: {key, delay: 0}}));
          }
        } else {
          // End time event if key was released
          if (this.#keyStates[key]) {
            const delay = performance.now() - this.#keyStates[key];
            events.push(new CustomEvent('keyup', {detail: {key, delay}}));
          }
          this.#keyStates[key] = 0;
        }
      });
      events.forEach((event) => this.dispatchEvent(event));
      return true;
    } catch {
      // Device was probably disconnected
      return false;
    }
  }

  /**
   * Wait for Stream Deck key input and yield key states
   * @yields {Array} key states
   */
  async *iterateKeys(): AsyncGenerator<boolean[]> {
    while (this.isOpen) {
      const success = await this.readKeys();
      if (success) yield this.keyStates;
    }
  }

  /**
   * Wait for Stream Deck key input and trigger events
   */
  async listenKeys(): Promise<void> {
    while (this.isOpen) {
      await this.readKeys();
    }
  }
}
