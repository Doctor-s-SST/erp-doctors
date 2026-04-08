const ESC = 0x1B;
const GS = 0x1D;

export const commands = {
  init: Buffer.from([ESC, 0x40]),
  align: {
    left: Buffer.from([ESC, 0x61, 0x00]),
    center: Buffer.from([ESC, 0x61, 0x01]),
    right: Buffer.from([ESC, 0x61, 0x02]),
  },
  bold: (on: boolean) => Buffer.from([ESC, 0x45, on ? 1 : 0]),
  size: {
    normal: Buffer.from([ESC, 0x21, 0x00]),
    double: Buffer.from([ESC, 0x21, 0x30]),
  },
  cut: Buffer.from([GS, 0x56, 0x41, 0x10]),
};

export function text(txt: string) {
  return Buffer.from(txt, "latin1");
}