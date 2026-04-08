import { commands, text } from "./escpos-builder";

type Line = {
  value: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  size?: "normal" | "double";
  br?: number;
};

export function buildPrint(lines: Line[]) {
  const buffer: Buffer[] = [];

  buffer.push(commands.init);

  lines.forEach((line) => {
    buffer.push(commands.align[line.align || "left"]);
    buffer.push(commands.bold(!!line.bold));
    buffer.push(commands.size[line.size || "normal"]);

    buffer.push(text(line.value));

    buffer.push(text("\n".repeat(line.br ?? 1)));

    // reset após cada linha (evita bug)
    buffer.push(commands.bold(false));
    buffer.push(commands.size.normal);
  });

  buffer.push(commands.cut);

  return Buffer.concat(buffer);
}