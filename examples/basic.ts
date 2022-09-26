// deno run --unstable --allow-all examples/basic.ts
Deno.env.set('DENO_USBHIDAPI', '/opt/homebrew/opt/hidapi/lib/libhidapi.dylib');

// Dynamic import to set environment variable before module
const {devices, StreamDeck} = await import('../mod.ts');

const streamDeck = new StreamDeck(devices.mk2);

streamDeck.addEventListener('open', () => {
  console.debug('Stream Deck open');
});

streamDeck.addEventListener('close', () => {
  console.log('Stream Deck closed');
});

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
}, 2000);

await new Promise((resolve) => {
  setTimeout(resolve, 60000);
});
