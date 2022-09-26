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

streamDeck.addEventListener('disconnect', () => {
  console.log('Stream Deck disconnected (auto-reconnect)');
});

streamDeck.addEventListener('keystates', () => {
  console.log('Stream Deck key states updated');
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
  const {pathname} = new URL('72x72.jpg', import.meta.url);
  streamDeck.setKeyJpeg(7, pathname);
}, 2000);

setTimeout(async () => {
  console.log('Test read keys');
  const success = await streamDeck.readKeys();
  if (success) {
    console.log(streamDeck.keyStates);
  }
  console.log('Test listen keys');
  for await (const states of streamDeck.listenKeys()) {
    console.log(states);
  }
}, 4000);

await new Promise((resolve) => {
  setTimeout(resolve, 60000);
});
