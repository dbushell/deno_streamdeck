import {HID, HIDInfo} from 'https://deno.land/x/deno_usbhidapi@v0.2.1/mod.ts';
import JPEG from 'https://cdn.skypack.dev/jpeg-js?dts';
import {DeckInfo} from './types.ts';

export class StreamDeck extends EventTarget {
  // HIDAPI pointer
  #hid: bigint;

  // Device and HIDAPI information
  #info: DeckInfo;
  #hidInfo: HIDInfo | null;

  #keyStates: boolean[];
  #keyBlank: Uint8Array;

  #conTimeout = 0;
  #conInterval = 0;
  #conRate = 1000;

  /**
   * Create a new StreamDeck instance
   * @param info a known device
   */
  constructor(info: DeckInfo) {
    super();
    this.#info = {...info};
    this.#hidInfo = null;
    this.#hid = 0n;

    // Set default off state for all keys
    this.#keyStates = Array(this.keyCount).fill(false);

    // Generate black image for off state
    this.#keyBlank = JPEG.encode(
      {
        width: this.keySize[0],
        height: this.keySize[1],
        data: new Uint8Array(this.keySize[0] * this.keySize[1] * 4)
      },
      100
    ).data;

    // Add event listeners
    this.addEventListener('open', this.#onOpen);
    this.addEventListener('close', this.#onClose);
  }

  get hid(): bigint {
    return this.#hid;
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
    return this.#keyStates;
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
  open() {
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
  close() {
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
    const [id, length, offset] = this.info.firmwareFeature;
    const firmware = new Uint8Array(length);
    firmware[0] = id;
    HID.getFeatureReport(this.hid, firmware);
    this.#info.firmware = new TextDecoder().decode(
      firmware.subarray(offset, firmware.indexOf(0))
    );
    // Start poll interval to auto-reconnect
    this.#conInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('Stream Deck disconnected');
        this.open();
      }
    }, this.#conRate);
  }

  #onClose() {
    // Do nothing...
  }
}
