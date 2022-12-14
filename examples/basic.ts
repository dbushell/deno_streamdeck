// deno run --unstable --allow-all examples/basic.ts
Deno.env.set('DENO_USBHIDAPI', '/opt/homebrew/opt/hidapi/lib/libhidapi.dylib');

// Dynamic import to set environment variable before module
const {StreamDeck} = await import('../mod.ts');
import {DeckType} from '../src/types.ts';

const streamDeck = new StreamDeck(DeckType.MK2);

streamDeck.addEventListener('open', () => {
  console.debug('Stream Deck open');
});

streamDeck.addEventListener('close', () => {
  console.log('Stream Deck closed');
});

streamDeck.addEventListener('disconnect', () => {
  console.log('Stream Deck disconnected (auto-reconnect)');
});

streamDeck.addEventListener('keydown', ((ev: CustomEvent) => {
  console.log('keydown', ev.detail);
}) as EventListener);

streamDeck.addEventListener('keyup', ((ev: CustomEvent) => {
  console.log('keyup', ev.detail);
}) as EventListener);

await new Promise((resolve) => {
  streamDeck.addEventListener(
    'open',
    () => {
      console.log(streamDeck.info);
      console.log(streamDeck.hidInfo);
      resolve(true);
    },
    {once: true}
  );
  streamDeck.open();
});

setTimeout(() => {
  console.log('Test reopen without close');
  streamDeck.open();
}, 1000);

setTimeout(() => {
  console.log('Test immediate close and reopen');
  console.log('close:', streamDeck.close());
  streamDeck.open();
  streamDeck.reset();
  streamDeck.brightness(100);
  const {pathname} = new URL('assets/calculator.jpg', import.meta.url);
  streamDeck.setKeyJpeg(7, pathname);
}, 2000);

setTimeout(async () => {
  console.log('Test read keys');
  const success = await streamDeck.readKeys();
  if (success) {
    console.log(streamDeck.keyStates);
  }
  console.log('Test listen keys');
  for await (const keys of streamDeck.iterateKeys()) {
    console.log(keys);
  }
}, 4000);

await new Promise((resolve) => {
  setTimeout(resolve, 60000);
});
