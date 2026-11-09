const chalk = require("chalk").default;

const WIDTH = 68;

/*
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  URSINHO                                                         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
*/

const LOGO = [
  "██╗   ██╗██████╗ ███████╗██╗███╗   ██╗██╗  ██╗ ██████╗",
  "██║   ██║██╔══██╗██╔════╝██║████╗  ██║██║  ██║██╔═══██╗",
  "██║   ██║██████╔╝███████╗██║██╔██╗ ██║███████║██║   ██║",
  "██║   ██║██╔══██╗╚════██║██║██║╚██╗██║██╔══██║██║   ██║",
  "╚██████╔╝██║  ██║███████║██║██║ ╚████║██║  ██║╚██████╔╝",
  " ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝"
];

function timestamp() {
  return new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function border(char = "─") {
  return char.repeat(WIDTH - 2);
}

function padCenter(text) {
  const value = String(text);
  const available = WIDTH - 2;

  if (value.length >= available) {
    return value.slice(0, available);
  }

  const left = Math.floor((available - value.length) / 2);
  const right = available - value.length - left;

  return " ".repeat(left) + value + " ".repeat(right);
}

/* =========================
   BANNER
========================= */

function banner() {
  console.log("");

  console.log(
    chalk.cyanBright("╔" + border("═") + "╗")
  );

  console.log(
    chalk.cyanBright("║") +
    " ".repeat(WIDTH - 2) +
    chalk.cyanBright("║")
  );

  for (let i = 0; i < LOGO.length; i++) {
    const colors = [
      chalk.cyanBright,
      chalk.blueBright,
      chalk.magentaBright,
      chalk.magentaBright,
      chalk.blueBright,
      chalk.cyanBright
    ];

    const line = LOGO[i];

    console.log(
      chalk.cyanBright("║") +
      "  " +
      colors[i].bold(line) +
      " ".repeat(
        Math.max(
          0,
          WIDTH - 4 - line.length
        )
      ) +
      chalk.cyanBright("║")
    );
  }

  console.log(
    chalk.cyanBright("║") +
    " ".repeat(WIDTH - 2) +
    chalk.cyanBright("║")
  );

  console.log(
    chalk.cyanBright("║") +
    chalk.yellowBright.bold(
      padCenter("URSINHO X BOT V2")
    ) +
    chalk.cyanBright("║")
  );

  console.log(
    chalk.cyanBright("║") +
    chalk.magentaBright.bold(
      padCenter("PREMIUM MZ")
    ) +
    chalk.cyanBright("║")
  );

  console.log(
    chalk.cyanBright("║") +
    chalk.gray(
      padCenter("WhatsApp • Baileys • Termux • OCR")
    ) +
    chalk.cyanBright("║")
  );

  console.log(
    chalk.cyanBright("║") +
    " ".repeat(WIDTH - 2) +
    chalk.cyanBright("║")
  );

  console.log(
    chalk.cyanBright("╚" + border("═") + "╝")
  );

  console.log("");
}

/* =========================
   SEÇÕES
========================= */

function section(title, icon = "◆") {
  const label = ` ${icon} ${title} `;
  const available = WIDTH - 3 - label.length;

  console.log(
    chalk.cyanBright("╭─") +
    chalk.yellowBright.bold(label) +
    chalk.cyanBright(
      "─".repeat(Math.max(1, available)) +
      "╮"
    )
  );
}

function sectionEnd() {
  console.log(
    chalk.cyanBright(
      "╰" + border() + "╯"
    )
  );
}

/* =========================
   STATUS
========================= */

function status(label, value, type = "ok") {
  const icons = {
    ok: "✓",
    info: "ℹ",
    warn: "⚠",
    err: "✗"
  };

  const colors = {
    ok: chalk.greenBright,
    info: chalk.cyanBright,
    warn: chalk.yellowBright,
    err: chalk.redBright
  };

  const icon = icons[type] || icons.info;
  const color = colors[type] || colors.info;

  const labelText = String(label).padEnd(18);
  const valueText = String(value);

  const contentLength =
    2 +
    1 +
    1 +
    18 +
    valueText.length;

  const spaces = Math.max(
    1,
    WIDTH - 4 - contentLength
  );

  console.log(
    chalk.cyanBright("│ ") +
    color(icon) +
    " " +
    chalk.white(labelText) +
    chalk.whiteBright(valueText) +
    " ".repeat(spaces) +
    chalk.cyanBright(" │")
  );
}

/* =========================
   BOX
========================= */

function box(title, lines = []) {
  console.log("");

  const label = ` ${title} `;
  const available = WIDTH - 3 - label.length;

  console.log(
    chalk.cyanBright("╭─") +
    chalk.yellowBright.bold(label) +
    chalk.cyanBright(
      "─".repeat(Math.max(1, available)) +
      "╮"
    )
  );

  for (const line of lines) {
    const text = String(line).slice(
      0,
      WIDTH - 4
    );

    console.log(
      chalk.cyanBright("│ ") +
      chalk.white(text.padEnd(WIDTH - 4)) +
      chalk.cyanBright(" │")
    );
  }

  console.log(
    chalk.cyanBright(
      "╰" + border() + "╯"
    )
  );
}

/* =========================
   LOGS
========================= */

function message(icon, color, text) {
  console.log(
    chalk.gray(`[${timestamp()}] `) +
    color(icon) +
    " " +
    chalk.white(text)
  );
}

const log = {

  banner,

  box,

  section,

  sectionEnd,

  status,

  ok: (text) =>
    message(
      "✓",
      chalk.greenBright,
      text
    ),

  info: (text) =>
    message(
      "ℹ",
      chalk.cyanBright,
      text
    ),

  warn: (text) =>
    message(
      "⚠",
      chalk.yellowBright,
      text
    ),

  err: (text) =>
    message(
      "✗",
      chalk.redBright,
      text
    ),

  hint: (text) =>
    console.log(
      chalk.gray(
        `             → ${text}`
      )
    ),

  step: (number, text) =>
    console.log(
      chalk.gray(`[${timestamp()}] `) +
      chalk.magentaBright.bold(
        `◆ ${number}`
      ) +
      " " +
      chalk.whiteBright.bold(text)
    ),

  raw: (text) =>
    console.log(text)
};

module.exports = log;
