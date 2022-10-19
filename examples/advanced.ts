// deno run --unstable --allow-all examples/advanced.ts
Deno.env.set('DENO_USBHIDAPI', '/opt/homebrew/opt/hidapi/lib/libhidapi.dylib');

// Dynamic import to set environment variable before module
const {AppDeck} = await import('../mod.ts');
import {DeckType} from '../src/types.ts';

const deck = new AppDeck(DeckType.MK2);
deck.brightness(50);

deck.setIcon('close', new URL('assets/close.jpg', import.meta.url).pathname);

deck.addEventListener('keyup', ((ev: CustomEvent) => {
  console.log('keyup', ev.detail);
}) as EventListener);

try {
  deck.loadApp(
    'calculator',
    new URL('assets/calculator.jpg', import.meta.url).pathname,
    [new URL('assets/numeric.jpg', import.meta.url).pathname]
  );
  deck.loadApp(
    'keyboard',
    new URL('assets/keyboard.jpg', import.meta.url).pathname,
    [new URL('assets/alphabet.jpg', import.meta.url).pathname]
  );
} catch (err) {
  console.log(err);
}
