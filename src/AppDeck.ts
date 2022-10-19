import JPEG from 'https://cdn.skypack.dev/jpeg-js?dts';
import {StreamDeck} from './StreamDeck.ts';
import {DeckType, DeckInfo} from './types.ts';

export interface Keypad {
  data: Uint8Array;
  keyData: Uint8Array[];
}

export interface App {
  uuid: string;
  icon: Uint8Array;
  keypads: Keypad[];
  keyBlanks: boolean[];
  keyStates: number[];
}

export class AppDeck extends StreamDeck {
  #screen: Uint8Array;
  #icons: Map<string, Uint8Array> = new Map();
  #apps: Map<string, App> = new Map();
  #activeApp = '';

  /**
   * Create a new AppDeck instance
   * @param {DeckType | string} type - a known device type
   * @param {DeckInfo} info - (optional) custom device information
   */
  constructor(type: DeckType | string, info?: DeckInfo) {
    super(type, info);
    // Create a buffer to hold the display data
    this.#screen = new Uint8Array(
      super.keyCount * super.keySize[0] * super.keySize[1] * 4
    );
    this.addEventListener('open', this.#onOpen);
    this.addEventListener('keydown', this.#onKeyDown as EventListener);
    this.addEventListener('keyup', this.#onKeyUp as EventListener);
    super.open();
  }

  /**
   * Screenshot the current Stream Deck display
   * @returns {Uint8Array} JPEG encoded image data
   */
  get screenshot(): Uint8Array {
    return JPEG.encode(
      {
        data: this.#screen,
        width: super.keyLayout[0] * super.keySize[0],
        height: super.keyLayout[1] * super.keySize[1]
      },
      100
    ).data;
  }

  /**
   * Return the active app or null if menu is active
   */
  get activeApp(): App | null {
    return this.#apps.has(this.#activeApp)
      ? this.#apps.get(this.#activeApp)!
      : null;
  }

  /**
   * Handle `open` event and start key listener
   */
  #onOpen = async (): Promise<void> => {
    super.reset();
    this.showMenu();
    await super.listenKeys();
  };

  /**
   * Handle `keydown` event
   */
  #onKeyDown(ev: CustomEvent) {
    const {key} = ev.detail;
    if (this.activeApp) {
      ev.detail.app = this.activeApp.uuid;
      if (key === super.keyLayout[0] - 1) {
        ev.stopImmediatePropagation();
        return;
      }
      if (this.activeApp.keyBlanks[key]) {
        ev.stopImmediatePropagation();
      }
      return;
    }
    ev.stopImmediatePropagation();
  }

  /**
   * Handle `keyup` event
   */
  #onKeyUp(ev: CustomEvent) {
    const {key} = ev.detail;
    if (this.activeApp) {
      ev.detail.app = this.activeApp.uuid;
      // Return to menu if top-right key is pressed
      if (key === super.keyLayout[0] - 1) {
        ev.stopImmediatePropagation();
        this.showMenu();
        return;
      }
      if (this.activeApp.keyBlanks[key]) {
        ev.stopImmediatePropagation();
      }
      return;
    }
    // Open app if key is pressed
    ev.stopImmediatePropagation();
    if (key < this.#apps.size) {
      this.showApp([...this.#apps.keys()][key]);
    }
  }

  /**
   * Set the menu display
   */
  showMenu(): void {
    this.#activeApp = '';
    let i = 0;
    for (const app of this.#apps.values()) {
      this.setKeyData(i++, app.icon);
    }
    for (; i < super.keyCount; i++) {
      this.setKeyData(i);
    }
  }

  /**
   * Set the active app display
   * @param {string} uuid - app name
   */
  showApp(uuid: string): boolean {
    if (!this.#apps.has(uuid)) {
      return false;
    }
    const start = performance.now();
    this.#activeApp = uuid;
    for (let k = 0; k < super.keyCount; k++) {
      this.setAppKey(k);
    }
    console.log(performance.now() - start);
    return true;
  }

  /**
   * Set an individual Stream Deck key image
   * @param {number} key - zero-based key index
   * @param {Uint8Array} data - raw 32-bit RGBA image data
   * @param {symbol} id - unique ID to avoid rewriting the same data
   */
  setKeyData(
    key: number,
    data: Uint8Array = super.keyBlank,
    id: symbol | null = null
  ): void {
    super.setKeyData(key, data, id);
    // Write key data to the screen buffer
    const [kx, ky] = super.getKeyXY(key);
    const [width, height] = super.keySize;
    for (let y = 0; y < height; y++) {
      const dy = y * width * 4;
      const sy = (ky * height + y) * super.keyLayout[0] * width * 4;
      const sx = kx * width * 4;
      this.#screen.set(data.slice(dy, dy + width * 4), sy + sx);
    }
  }

  /**
   * Update an single Stream Deck key for the current app
   * @param k - key index
   */
  setAppKey(k: number): void {
    if (!this.activeApp) return;
    const app = this.activeApp;
    const width = super.keyLayout[0] * super.keySize[0] * 4;
    // Use top-right key as "close app" button
    if (k === super.keyLayout[0] - 1 && this.#icons.has('close')) {
      this.setKeyData(k, this.#icons.get('close'));
      return;
    }
    // Skip blank keys
    if (app.keyBlanks[k]) {
      this.setKeyData(k);
      return;
    }
    const keypad = app.keypads[app.keyStates[k] ?? 0];
    // Skip cached keys
    if (keypad.keyData[k]) {
      this.setKeyData(k, keypad.keyData[k]);
      return;
    }
    let isBlank = true;
    const [x, y] = super.getKeyXY(k);
    const data = new Uint8Array(super.keySize[0] * super.keySize[1] * 4);
    let offset = x * super.keySize[0] * 4;
    offset += y * super.keySize[1] * width;
    for (let i = 0; i < super.keySize[1]; i++) {
      const j = i * width + offset;
      const slice = keypad.data.slice(j, j + super.keySize[0] * 4);
      // Check at least one pixel is not black (ignoring alpha)
      if (isBlank) {
        isBlank = !slice.some((v, vi) => (vi % 4 === 3 ? false : v !== 0));
      }
      data.set(slice, i * super.keySize[0] * 4);
    }
    if (isBlank) {
      app.keyBlanks[k] = isBlank;
    } else {
      keypad.keyData[k] = data;
    }
    this.setKeyData(k, isBlank ? super.keyBlank : data);
  }

  /**
   * Set an indvidual key state to use a different keypad image
   * @param {string} uuid - app name
   * @param {number} key - key index
   * @param {number} state - keypad index
   * @returns {boolean} true if key state was changed
   */
  setAppKeyState(uuid: string, key: number, state: number): boolean {
    if (!this.#apps.has(uuid)) {
      return false;
    }
    const app = this.#apps.get(uuid)!;
    if (!app.keypads[state]) {
      return false;
    }
    app.keyStates[key] = state;
    if (app === this.activeApp) {
      this.setAppKey(key);
    }
    return true;
  }

  /**
   * Add an app
   * @param {string} uuid - app name
   * @param {string | Uint8Array} icon - path to icon image
   * @param {string[] | Uint8Array[]} images - paths to image data
   */
  loadApp(
    uuid: string,
    icon: string | Uint8Array,
    images: string[] | Uint8Array[]
  ): void {
    // Expected byte lengths
    const iconLength = super.keySize[0] * super.keySize[1] * 4;
    const dataLength = super.keyCount * super.keySize[0] * super.keySize[1] * 4;
    // Read icon file is path was provided
    if (typeof icon === 'string') {
      if (!Deno.statSync(icon).isFile) {
        throw new Error('Icon file not found');
      }
      icon = JPEG.decode(Deno.readFileSync(icon), {useTArray: true}).data;
    }
    if (icon.length !== iconLength) {
      throw new Error('Icon size incorrect');
    }
    const keypads: Keypad[] = images.map((data) => {
      // Read image files if paths were provided
      if (typeof data === 'string') {
        if (!Deno.statSync(data).isFile) {
          throw new Error('Image file not found');
        }
        data = JPEG.decode(Deno.readFileSync(data), {useTArray: true}).data;
      }
      if (data.length !== dataLength) {
        throw new Error('Image size incorrect');
      }
      return {
        data,
        keyData: []
      };
    });
    this.#apps.set(uuid, {
      uuid,
      icon,
      keypads,
      keyBlanks: [],
      keyStates: []
    });
    if (!this.activeApp) {
      this.showMenu();
    }
  }

  /**
   * Remove an app
   * @param {string} uuid - app name
   * @returns {boolean} true if app was removed
   */
  unloadApp(uuid: string): boolean {
    if (!this.#apps.has(uuid)) {
      return false;
    }
    this.#apps.delete(uuid);
    if (!this.activeApp || this.#activeApp === uuid) {
      this.showMenu();
    }
    return true;
  }

  /**
   * Set a system icon
   * @param {string} name - icon name
   * @param {string} path - path to image data
   */
  setIcon(name: string, path: string): void {
    if (!Deno.statSync(path).isFile) {
      throw new Error('Icon file not found');
    }
    const icon = JPEG.decode(Deno.readFileSync(path), {useTArray: true});
    if (icon.width !== super.keySize[0]) {
      throw new Error('Icon width incorrect');
    }
    if (icon.height !== super.keySize[1]) {
      throw new Error('Icon height incorrect');
    }
    this.#icons.set(name, icon.data);
  }
}
